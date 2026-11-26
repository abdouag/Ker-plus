import 'server-only';

import { Prisma, type AppointmentType, type RequestStatus } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateUniqueReference } from '@/lib/reference';
import { getSettingBool, getSettingInt, SETTING_KEYS } from '@/lib/settings';
import { CARE_UPLOAD } from '../constants';
import { CareError } from '../errors';
import { addMonths } from '../maintenance';
import { computeQuote, isQuoteExpired } from '../quote';
import { deleteStoredFile, storeFile, validateUpload, type ValidatedUpload } from '../storage';
import type {
  appointmentSchema,
  quoteSchema,
  reportSchema,
  requestSchema,
  reviewSchema,
} from '../validation';
import { combineDateTime } from '../validation';
import { ON_SITE_STATUSES } from '../workflow';
import { logRequestEvent, transitionRequest, type CareActor, type Tx } from './core';

// ===========================================================================
// Création d'une demande (client)
// ===========================================================================

type RequestInput = z.infer<typeof requestSchema>;

/**
 * Crée une demande d'intervention.
 *
 * Idempotente : la clé générée par le formulaire est unique en base ; un
 * double clic ou une relance réseau renvoie la demande déjà créée au lieu
 * d'en créer une seconde.
 */
export async function createServiceRequest(
  requesterId: string,
  input: RequestInput,
  photos: File[],
): Promise<{ reference: string; created: boolean }> {
  const existing = await prisma.serviceRequest.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { reference: true, requesterId: true },
  });
  if (existing) {
    if (existing.requesterId !== requesterId) throw new CareError('Demande invalide.', 400);
    return { reference: existing.reference, created: false };
  }

  if (!(await getSettingBool(SETTING_KEYS.CARE_ENABLED, true))) {
    throw new CareError(
      'Les demandes d’intervention sont momentanément suspendues. Contactez Kerplus directement.',
      503,
    );
  }

  if (input.kind === 'EMERGENCY' && !input.safetyAcknowledged) {
    throw new CareError(
      'Confirmez avoir lu les consignes de sécurité et contacté les secours si nécessaire.',
      400,
    );
  }

  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, ownerId: requesterId, archivedAt: null },
  });
  if (!property) throw new CareError('Logement introuvable.', 404);

  const category = await prisma.careCategory.findFirst({
    where: { id: input.categoryId, active: true },
  });
  if (!category) throw new CareError('Catégorie de service indisponible.', 400);

  if (input.equipmentId) {
    const equipment = await prisma.equipment.findFirst({
      where: { id: input.equipmentId, propertyId: property.id, archivedAt: null },
    });
    if (!equipment) throw new CareError('Équipement introuvable pour ce logement.', 404);
  }

  let taskId: string | null = null;
  if (input.maintenanceTaskId) {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: input.maintenanceTaskId, propertyId: property.id, status: 'TODO' },
    });
    if (!task) throw new CareError('Entretien introuvable ou déjà planifié.', 404);
    taskId = task.id;
  }

  const uploads: ValidatedUpload[] = await Promise.all(
    photos.map((file) => validateUpload(file, CARE_UPLOAD.imageTypes)),
  );
  const storedKeys: string[] = [];
  for (const upload of uploads) storedKeys.push(await storeFile(upload));

  const reference = await generateUniqueReference('DEP', async (candidate) =>
    Boolean(await prisma.serviceRequest.findUnique({ where: { reference: candidate } })),
  );

  try {
    await prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.create({
        data: {
          reference,
          idempotencyKey: input.idempotencyKey,
          propertyId: property.id,
          requesterId,
          categoryId: category.id,
          equipmentId: input.equipmentId ?? null,
          description: input.description,
          kind: input.kind,
          preferredDate: input.preferredDate ?? null,
          preferredSlot: input.preferredSlot ?? null,
        },
      });
      await tx.requestStatusEvent.create({
        data: {
          requestId: request.id,
          toStatus: 'SUBMITTED',
          actorType: 'CLIENT',
          actorAccountId: requesterId,
          reason: 'Demande envoyée',
        },
      });
      if (taskId) {
        await tx.maintenanceTask.update({
          where: { id: taskId },
          data: { status: 'PLANNED', requestId: request.id },
        });
      }
      for (const [index, upload] of uploads.entries()) {
        await tx.attachment.create({
          data: {
            kind: 'PHOTO',
            requestId: request.id,
            uploadedById: requesterId,
            fileKey: storedKeys[index],
            fileName: upload.fileName,
            mimeType: upload.mimeType,
            sizeBytes: upload.buffer.byteLength,
          },
        });
      }
    });
  } catch (error) {
    await Promise.all(storedKeys.map((key) => deleteStoredFile(key)));
    // Double soumission concurrente : la première demande l'a emporté.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const winner = await prisma.serviceRequest.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { reference: true, requesterId: true },
      });
      if (winner && winner.requesterId === requesterId) {
        return { reference: winner.reference, created: false };
      }
    }
    throw error;
  }

  return { reference, created: true };
}

// ===========================================================================
// Lecture
// ===========================================================================

const ACTIVE_ASSIGNMENT: Prisma.AssignmentWhereInput = { status: { in: ['PENDING', 'ACCEPTED'] } };

export async function listClientRequests(requesterId: string) {
  return prisma.serviceRequest.findMany({
    where: { requesterId },
    orderBy: { createdAt: 'desc' },
    include: {
      property: { select: { id: true, name: true } },
      category: { select: { name: true } },
      equipment: { select: { name: true } },
      appointments: {
        where: { status: { in: ['PROPOSED', 'CONFIRMED'] } },
        orderBy: { startsAt: 'asc' },
      },
      quotes: { where: { status: 'SENT' }, select: { id: true } },
    },
  });
}

const providerPublicSelect = {
  id: true,
  businessName: true,
  verificationStatus: true,
  specialties: true,
  account: { select: { name: true, phone: true } },
} satisfies Prisma.ProviderProfileSelect;

/** Détail complet d'une demande pour son auteur. */
export async function getClientRequest(requesterId: string, reference: string) {
  const request = await prisma.serviceRequest.findFirst({
    where: { reference, requesterId },
    include: {
      property: true,
      category: true,
      equipment: true,
      attachments: { where: { reportId: null }, orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
      assignments: {
        orderBy: { assignedAt: 'desc' },
        include: { provider: { select: providerPublicSelect } },
      },
      quotes: { orderBy: { version: 'desc' }, include: { lines: { orderBy: { position: 'asc' } } } },
      appointments: { orderBy: { startsAt: 'asc' } },
      reports: {
        orderBy: { revision: 'desc' },
        include: { attachments: { orderBy: { createdAt: 'asc' } } },
      },
      review: true,
    },
  });
  if (!request) throw new CareError('Demande introuvable.', 404);

  const current = request.assignments.find((a) => a.status === 'ACCEPTED' || a.status === 'PENDING');
  return {
    ...request,
    currentProvider: current
      ? {
          businessName: current.provider.businessName,
          name: current.provider.account.name,
          verified: current.provider.verificationStatus === 'VERIFIED',
          // Le téléphone n'est communiqué qu'une fois la mission acceptée.
          phone: current.status === 'ACCEPTED' ? current.provider.account.phone : null,
          accepted: current.status === 'ACCEPTED',
        }
      : null,
  };
}

/** Assignation active d'un prestataire sur une demande, ou erreur. */
async function requireAssignment(
  db: Tx | typeof prisma,
  providerId: string,
  requestId: string,
  accepted = true,
) {
  const assignment = await db.assignment.findFirst({
    where: {
      requestId,
      providerId,
      status: accepted ? 'ACCEPTED' : { in: ['PENDING', 'ACCEPTED'] },
    },
  });
  if (!assignment) throw new CareError('Mission introuvable.', 404);
  return assignment;
}

export async function listProviderMissions(providerId: string) {
  return prisma.assignment.findMany({
    where: { providerId },
    orderBy: { assignedAt: 'desc' },
    include: {
      request: {
        include: {
          category: { select: { name: true } },
          property: { select: { commune: true, quartier: true } },
          appointments: {
            where: { providerId, status: { in: ['PROPOSED', 'CONFIRMED'] } },
            orderBy: { startsAt: 'asc' },
          },
        },
      },
    },
  });
}

/**
 * Vue prestataire d'une mission. Tant que la mission n'est pas acceptée,
 * seules les informations nécessaires à la décision sont communiquées
 * (pas d'adresse précise ni de coordonnées du client).
 */
export async function getProviderMission(providerId: string, reference: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { reference },
    include: {
      category: true,
      equipment: { select: { name: true, brand: true, model: true, installedAt: true, lastServiceAt: true } },
      property: true,
      requester: { select: { name: true, phone: true } },
      attachments: { where: { reportId: null }, orderBy: { createdAt: 'asc' } },
      assignments: { where: { providerId }, orderBy: { assignedAt: 'desc' } },
      quotes: {
        where: { providerId },
        orderBy: { version: 'desc' },
        include: { lines: { orderBy: { position: 'asc' } } },
      },
      appointments: { where: { providerId }, orderBy: { startsAt: 'asc' } },
      reports: {
        where: { providerId },
        orderBy: { revision: 'desc' },
        include: { attachments: true },
      },
      events: { orderBy: { createdAt: 'asc' } },
      review: true,
    },
  });
  const assignment = request?.assignments.find(
    (item) => item.status === 'PENDING' || item.status === 'ACCEPTED',
  );
  // Une mission refusée ou retirée n'est plus consultable.
  if (!request || !assignment) throw new CareError('Mission introuvable.', 404);

  const accepted = assignment.status === 'ACCEPTED';
  const { property, requester, ...rest } = request;
  return {
    ...rest,
    assignment,
    accepted,
    property: {
      type: property.type,
      commune: property.commune,
      quartier: property.quartier,
      surface: property.surface,
      levels: property.levels,
      landmark: accepted ? property.landmark : null,
      address: accepted ? property.address : null,
    },
    client: accepted ? requester : null,
  };
}

// ===========================================================================
// Affectation (admin) et réponse du prestataire
// ===========================================================================

async function releaseOpenItems(tx: Tx, requestId: string, reason: string) {
  await tx.quote.updateMany({ where: { requestId, status: 'SENT' }, data: { status: 'SUPERSEDED' } });
  await tx.appointment.updateMany({
    where: { requestId, status: { in: ['PROPOSED', 'CONFIRMED'] } },
    data: { status: 'CANCELLED', cancelReason: reason },
  });
}

export async function assignProvider(
  adminId: string,
  requestId: string,
  providerId: string,
): Promise<void> {
  const [request, provider] = await Promise.all([
    prisma.serviceRequest.findUnique({ where: { id: requestId }, include: { category: true } }),
    prisma.providerProfile.findUnique({ where: { id: providerId }, include: { account: true } }),
  ]);
  if (!request) throw new CareError('Demande introuvable.', 404);
  if (!provider || !provider.account.active) throw new CareError('Prestataire introuvable.', 404);
  if (provider.verificationStatus !== 'VERIFIED') {
    throw new CareError('Seul un prestataire vérifié peut être affecté.', 409);
  }
  if (request.category.slug !== 'autre' && !provider.specialties.includes(request.category.slug)) {
    throw new CareError(
      `Ce prestataire ne couvre pas la catégorie « ${request.category.name} ».`,
      409,
    );
  }

  const actor: CareActor = { type: 'ADMIN', adminId };
  await prisma.$transaction(async (tx) => {
    const active = await tx.assignment.findMany({ where: { requestId, ...ACTIVE_ASSIGNMENT } });
    if (active.some((item) => item.providerId === providerId)) {
      throw new CareError('Ce prestataire est déjà affecté à la demande.', 409);
    }
    if (active.length > 0) {
      await tx.assignment.updateMany({
        where: { id: { in: active.map((item) => item.id) } },
        data: { status: 'WITHDRAWN', respondedAt: new Date(), reason: 'Réaffectation' },
      });
      await releaseOpenItems(tx, requestId, 'Réaffectation de la demande');
    }
    await tx.assignment.create({
      data: { requestId, providerId, assignedById: adminId, status: 'PENDING' },
    });
    await transitionRequest(tx, request, 'ASSIGNED', actor, {
      reason: `Prestataire affecté : ${provider.businessName || provider.account.name}`,
      data: request.firstResponseAt ? {} : { firstResponseAt: new Date() },
    });
  });
}

export async function withdrawAssignment(adminId: string, requestId: string, reason: string) {
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new CareError('Demande introuvable.', 404);
  await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.updateMany({
      where: { requestId, ...ACTIVE_ASSIGNMENT },
      data: { status: 'WITHDRAWN', respondedAt: new Date(), reason },
    });
    if (updated.count === 0) throw new CareError('Aucun prestataire affecté.', 409);
    await releaseOpenItems(tx, requestId, 'Prestataire retiré');
    await transitionRequest(tx, request, 'SEARCHING', { type: 'ADMIN', adminId }, { reason });
  });
}

export async function respondToAssignment(
  provider: { accountId: string; providerId: string },
  reference: string,
  accept: boolean,
  reason?: string,
) {
  const request = await prisma.serviceRequest.findUnique({ where: { reference } });
  if (!request) throw new CareError('Mission introuvable.', 404);
  const actor: CareActor = { type: 'PROVIDER', ...provider };

  await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findFirst({
      where: { requestId: request.id, providerId: provider.providerId, status: 'PENDING' },
    });
    if (!assignment) throw new CareError('Cette mission n’attend plus de réponse.', 409);
    if (!accept && !reason) throw new CareError('Indiquez le motif du refus.', 400);

    await tx.assignment.update({
      where: { id: assignment.id },
      data: {
        status: accept ? 'ACCEPTED' : 'REFUSED',
        respondedAt: new Date(),
        reason: reason ?? null,
      },
    });
    await transitionRequest(tx, request, accept ? 'ACCEPTED' : 'SEARCHING', actor, {
      reason: accept ? 'Mission acceptée par le prestataire' : `Mission refusée : ${reason}`,
    });
  });
}

// ===========================================================================
// Devis
// ===========================================================================

const QUOTE_ALLOWED: RequestStatus[] = [
  'ACCEPTED',
  'QUOTE_SENT',
  'QUOTE_REFUSED',
  'QUOTE_ACCEPTED',
  ...ON_SITE_STATUSES,
];

type QuoteInput = z.infer<typeof quoteSchema>;

/**
 * Émet une nouvelle version de devis. Les versions précédentes ne sont
 * jamais modifiées : une version en attente est marquée « remplacée », une
 * version acceptée reste acceptée. Après acceptation, toute nouvelle version
 * (supplément) doit être approuvée par le client.
 */
export async function createQuote(
  provider: { accountId: string; providerId: string },
  reference: string,
  input: QuoteInput,
) {
  const request = await prisma.serviceRequest.findUnique({ where: { reference } });
  if (!request) throw new CareError('Mission introuvable.', 404);
  await requireAssignment(prisma, provider.providerId, request.id);
  if (!QUOTE_ALLOWED.includes(request.status)) {
    throw new CareError('Un devis ne peut pas être émis à ce stade de la mission.', 409);
  }

  const computed = computeQuote(input);
  const quoteReference = await generateUniqueReference('DEV', async (candidate) =>
    Boolean(await prisma.quote.findUnique({ where: { reference: candidate } })),
  );
  const validUntil = new Date(Date.now() + input.validityDays * 24 * 3600 * 1000);
  validUntil.setUTCHours(23, 59, 59, 0);
  const actor: CareActor = { type: 'PROVIDER', ...provider };

  return prisma.$transaction(async (tx) => {
    const last = await tx.quote.findFirst({
      where: { requestId: request.id },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;
    const hasAccepted = await tx.quote.count({ where: { requestId: request.id, status: 'ACCEPTED' } });
    await tx.quote.updateMany({
      where: { requestId: request.id, status: 'SENT' },
      data: { status: 'SUPERSEDED' },
    });
    const quote = await tx.quote.create({
      data: {
        reference: quoteReference,
        requestId: request.id,
        providerId: provider.providerId,
        version,
        travelFee: input.travelFee,
        diagnosticFee: input.diagnosticFee,
        laborAmount: input.laborAmount,
        partsAmount: computed.partsAmount,
        otherFees: input.otherFees,
        discountAmount: input.discountAmount,
        taxAmount: input.taxAmount,
        totalAmount: computed.totalAmount,
        validUntil,
        conditions: input.conditions ?? null,
        exclusions: input.exclusions ?? null,
        note: input.note ?? null,
        lines: {
          create: computed.lines.map((line, position) => ({ ...line, position })),
        },
      },
    });
    if (request.status === 'ACCEPTED' || request.status === 'QUOTE_REFUSED') {
      await transitionRequest(tx, request, 'QUOTE_SENT', actor, {
        reason: `Devis v${version} envoyé`,
      });
    } else {
      await logRequestEvent(
        tx,
        request,
        actor,
        hasAccepted > 0 ? `Supplément : devis v${version} à approuver` : `Devis révisé v${version} envoyé`,
      );
    }
    return quote;
  });
}

async function getClientQuote(requesterId: string, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, request: { requesterId } },
    include: { request: true },
  });
  if (!quote) throw new CareError('Devis introuvable.', 404);
  return quote;
}

export async function acceptQuote(requesterId: string, quoteId: string) {
  const quote = await getClientQuote(requesterId, quoteId);
  if (quote.status !== 'SENT') throw new CareError('Ce devis n’est plus en attente de décision.', 409);
  if (isQuoteExpired(quote.validUntil)) {
    throw new CareError('Ce devis a expiré. Demandez une nouvelle proposition au prestataire.', 409);
  }
  const actor: CareActor = { type: 'CLIENT', accountId: requesterId };
  await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, status: 'SENT' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (updated.count !== 1) throw new CareError('Ce devis a été modifié entre-temps.', 409);
    if (quote.request.status === 'QUOTE_SENT') {
      await transitionRequest(tx, quote.request, 'QUOTE_ACCEPTED', actor, {
        reason: `Devis v${quote.version} accepté`,
      });
    } else {
      await logRequestEvent(tx, quote.request, actor, `Supplément v${quote.version} accepté`);
    }
  });
}

export async function refuseQuote(requesterId: string, quoteId: string, reason: string) {
  const quote = await getClientQuote(requesterId, quoteId);
  if (quote.status !== 'SENT') throw new CareError('Ce devis n’est plus en attente de décision.', 409);
  const actor: CareActor = { type: 'CLIENT', accountId: requesterId };
  await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, status: 'SENT' },
      data: { status: 'REFUSED', refusedAt: new Date(), refusalReason: reason || null },
    });
    if (updated.count !== 1) throw new CareError('Ce devis a été modifié entre-temps.', 409);
    const label = `Devis v${quote.version} refusé${reason ? ` : ${reason}` : ''}`;
    if (quote.request.status === 'QUOTE_SENT') {
      await transitionRequest(tx, quote.request, 'QUOTE_REFUSED', actor, { reason: label });
    } else {
      await logRequestEvent(tx, quote.request, actor, `Supplément refusé — ${label}`);
    }
  });
}

/** Dernière version acceptée — base des coûts approuvés. */
async function approvedQuote(tx: Tx, requestId: string) {
  return tx.quote.findFirst({
    where: { requestId, status: 'ACCEPTED' },
    orderBy: { version: 'desc' },
  });
}

// ===========================================================================
// Rendez-vous
// ===========================================================================

/** Verrou transactionnel par prestataire : sérialise les réservations. */
async function lockProvider(tx: Tx, providerId: string) {
  await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${providerId}))) AS verrou`;
}

async function assertNoConflict(
  tx: Tx,
  providerId: string,
  startsAt: Date,
  endsAt: Date,
  ignoreId?: string,
  statuses: ('PROPOSED' | 'CONFIRMED')[] = ['CONFIRMED'],
) {
  const conflict = await tx.appointment.findFirst({
    where: {
      providerId,
      status: { in: statuses },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
  });
  if (conflict) {
    throw new CareError('Ce créneau chevauche un autre rendez-vous du prestataire.', 409);
  }
}

type AppointmentInput = z.infer<typeof appointmentSchema>;

const DIAGNOSTIC_ALLOWED: RequestStatus[] = ['ACCEPTED', 'QUOTE_SENT', 'QUOTE_REFUSED'];

export async function proposeAppointment(
  provider: { accountId: string; providerId: string },
  reference: string,
  input: AppointmentInput,
) {
  const request = await prisma.serviceRequest.findUnique({ where: { reference } });
  if (!request) throw new CareError('Mission introuvable.', 404);
  await requireAssignment(prisma, provider.providerId, request.id);

  const type: AppointmentType = input.type;
  if (type === 'DIAGNOSTIC' && !DIAGNOSTIC_ALLOWED.includes(request.status)) {
    throw new CareError('Une visite de diagnostic se planifie avant l’acceptation du devis.', 409);
  }
  if (type === 'INTERVENTION' && request.status !== 'QUOTE_ACCEPTED') {
    throw new CareError('Le créneau d’intervention se propose une fois le devis accepté.', 409);
  }

  const startsAt = combineDateTime(input.date, input.startTime);
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000);
  if (startsAt.getTime() <= Date.now()) {
    throw new CareError('Proposez un créneau dans le futur.', 400);
  }

  const actor: CareActor = { type: 'PROVIDER', ...provider };
  return prisma.$transaction(async (tx) => {
    await lockProvider(tx, provider.providerId);
    // Un prestataire ne peut pas proposer deux rendez-vous incompatibles.
    await assertNoConflict(tx, provider.providerId, startsAt, endsAt, undefined, [
      'PROPOSED',
      'CONFIRMED',
    ]);
    const appointment = await tx.appointment.create({
      data: {
        requestId: request.id,
        providerId: provider.providerId,
        type,
        startsAt,
        endsAt,
        fee: type === 'DIAGNOSTIC' ? input.fee : 0,
        note: input.note ?? null,
      },
    });
    await logRequestEvent(
      tx,
      request,
      actor,
      `${type === 'DIAGNOSTIC' ? 'Visite de diagnostic' : 'Créneau d’intervention'} proposé`,
    );
    return appointment;
  });
}

export async function confirmAppointment(requesterId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, request: { requesterId } },
    include: { request: true },
  });
  if (!appointment) throw new CareError('Rendez-vous introuvable.', 404);
  if (appointment.status !== 'PROPOSED') throw new CareError('Ce rendez-vous n’est plus à confirmer.', 409);
  if (appointment.startsAt.getTime() <= Date.now()) {
    throw new CareError('Ce créneau est passé. Demandez une nouvelle proposition.', 409);
  }
  const { request } = appointment;
  if (appointment.type === 'INTERVENTION' && request.status !== 'QUOTE_ACCEPTED') {
    throw new CareError('Ce créneau ne peut plus être confirmé.', 409);
  }
  if (appointment.type === 'DIAGNOSTIC' && !DIAGNOSTIC_ALLOWED.includes(request.status)) {
    throw new CareError('Ce créneau ne peut plus être confirmé.', 409);
  }

  const actor: CareActor = { type: 'CLIENT', accountId: requesterId };
  await prisma.$transaction(async (tx) => {
    await lockProvider(tx, appointment.providerId);
    await assertNoConflict(tx, appointment.providerId, appointment.startsAt, appointment.endsAt, appointment.id);
    const updated = await tx.appointment.updateMany({
      where: { id: appointment.id, status: 'PROPOSED' },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
    if (updated.count !== 1) throw new CareError('Ce rendez-vous a été modifié entre-temps.', 409);
    // Les autres propositions du même type deviennent caduques.
    await tx.appointment.updateMany({
      where: {
        requestId: request.id,
        type: appointment.type,
        status: 'PROPOSED',
        id: { not: appointment.id },
      },
      data: { status: 'CANCELLED', cancelReason: 'Autre créneau retenu' },
    });
    if (appointment.type === 'INTERVENTION') {
      await transitionRequest(tx, request, 'SCHEDULED', actor, {
        reason: 'Rendez-vous d’intervention confirmé',
      });
    } else {
      await logRequestEvent(tx, request, actor, 'Visite de diagnostic confirmée (frais acceptés)');
    }
  });
}

/** Annulation ou report d'un rendez-vous par le client, le prestataire ou l'admin. */
export async function cancelAppointment(actor: CareActor, appointmentId: string, reason: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { request: true },
  });
  if (!appointment) throw new CareError('Rendez-vous introuvable.', 404);
  if (actor.type === 'CLIENT' && appointment.request.requesterId !== actor.accountId) {
    throw new CareError('Rendez-vous introuvable.', 404);
  }
  if (actor.type === 'PROVIDER' && appointment.providerId !== actor.providerId) {
    throw new CareError('Rendez-vous introuvable.', 404);
  }
  if (appointment.status !== 'PROPOSED' && appointment.status !== 'CONFIRMED') {
    throw new CareError('Ce rendez-vous ne peut plus être modifié.', 409);
  }
  if (!reason) throw new CareError('Indiquez le motif de l’annulation ou du report.', 400);

  const { request } = appointment;
  const wasScheduled =
    appointment.status === 'CONFIRMED' && appointment.type === 'INTERVENTION';
  if (wasScheduled && request.status !== 'SCHEDULED') {
    throw new CareError('L’intervention a déjà commencé : contactez Kerplus.', 409);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.updateMany({
      where: { id: appointment.id, status: appointment.status },
      data: { status: 'CANCELLED', cancelReason: reason },
    });
    if (updated.count !== 1) throw new CareError('Ce rendez-vous a été modifié entre-temps.', 409);
    if (wasScheduled) {
      await transitionRequest(tx, request, 'QUOTE_ACCEPTED', actor, {
        reason: `Rendez-vous annulé ou reporté : ${reason}`,
      });
    } else {
      await logRequestEvent(tx, request, actor, `Rendez-vous annulé : ${reason}`);
    }
  });
}

/** Le prestataire déclare la visite de diagnostic effectuée. */
export async function markDiagnosticDone(
  provider: { accountId: string; providerId: string },
  appointmentId: string,
) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, providerId: provider.providerId, type: 'DIAGNOSTIC', status: 'CONFIRMED' },
    include: { request: true },
  });
  if (!appointment) throw new CareError('Rendez-vous introuvable.', 404);
  await requireAssignment(prisma, provider.providerId, appointment.requestId);
  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id: appointment.id }, data: { status: 'DONE' } });
    await logRequestEvent(tx, appointment.request, { type: 'PROVIDER', ...provider }, 'Visite de diagnostic effectuée');
  });
}

// ===========================================================================
// Déroulé de l'intervention
// ===========================================================================

export async function advanceOnSite(
  provider: { accountId: string; providerId: string },
  reference: string,
  to: 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS',
) {
  const request = await prisma.serviceRequest.findUnique({ where: { reference } });
  if (!request) throw new CareError('Mission introuvable.', 404);
  await requireAssignment(prisma, provider.providerId, request.id);
  const labels = { EN_ROUTE: 'Prestataire en route', ARRIVED: 'Prestataire arrivé sur place', IN_PROGRESS: 'Intervention démarrée' };
  await prisma.$transaction((tx) =>
    transitionRequest(tx, request, to, { type: 'PROVIDER', ...provider }, { reason: labels[to] }),
  );
}

type ReportInput = z.infer<typeof reportSchema>;

/**
 * Dépôt du rapport de fin d'intervention → « travaux déclarés terminés ».
 * Les coûts approuvés proviennent du dernier devis accepté, jamais d'une
 * saisie libre.
 */
export async function submitReport(
  provider: { accountId: string; providerId: string },
  reference: string,
  input: ReportInput,
  photos: { before: File[]; after: File[] },
) {
  const request = await prisma.serviceRequest.findUnique({ where: { reference } });
  if (!request) throw new CareError('Mission introuvable.', 404);
  await requireAssignment(prisma, provider.providerId, request.id);
  if (request.status !== 'IN_PROGRESS') {
    throw new CareError('Le rapport se dépose une fois l’intervention démarrée.', 409);
  }
  const pending = await prisma.quote.count({ where: { requestId: request.id, status: 'SENT' } });
  if (pending > 0) {
    throw new CareError('Un supplément est en attente d’approbation par le client.', 409);
  }
  if (photos.before.length + photos.after.length > CARE_UPLOAD.maxFilesPerSubmit) {
    throw new CareError(`${CARE_UPLOAD.maxFilesPerSubmit} photos maximum par rapport.`, 400);
  }

  const validated = [
    ...(await Promise.all(photos.before.map((f) => validateUpload(f, CARE_UPLOAD.imageTypes)))).map(
      (upload) => ({ upload, kind: 'PHOTO_BEFORE' as const }),
    ),
    ...(await Promise.all(photos.after.map((f) => validateUpload(f, CARE_UPLOAD.imageTypes)))).map(
      (upload) => ({ upload, kind: 'PHOTO_AFTER' as const }),
    ),
  ];
  const keys: string[] = [];
  for (const item of validated) keys.push(await storeFile(item.upload));

  const actor: CareActor = { type: 'PROVIDER', ...provider };
  try {
    await prisma.$transaction(async (tx) => {
      const approved = await approvedQuote(tx, request.id);
      const last = await tx.interventionReport.findFirst({
        where: { requestId: request.id },
        orderBy: { revision: 'desc' },
      });
      const report = await tx.interventionReport.create({
        data: {
          requestId: request.id,
          providerId: provider.providerId,
          revision: (last?.revision ?? 0) + 1,
          diagnostic: input.diagnostic,
          workDone: input.workDone,
          partsUsed: input.partsUsed ?? null,
          recommendations: input.recommendations ?? null,
          durationMinutes: input.durationMinutes ?? null,
          nextMaintenanceAt: input.nextMaintenanceAt ?? null,
          approvedCost: approved?.totalAmount ?? null,
        },
      });
      for (const [index, item] of validated.entries()) {
        await tx.attachment.create({
          data: {
            kind: item.kind,
            requestId: request.id,
            reportId: report.id,
            uploadedById: provider.accountId,
            fileKey: keys[index],
            fileName: item.upload.fileName,
            mimeType: item.upload.mimeType,
            sizeBytes: item.upload.buffer.byteLength,
          },
        });
      }
      await tx.appointment.updateMany({
        where: { requestId: request.id, type: 'INTERVENTION', status: 'CONFIRMED' },
        data: { status: 'DONE' },
      });
      await transitionRequest(tx, request, 'WORK_DONE', actor, {
        reason: `Rapport d’intervention déposé${report.revision > 1 ? ` (révision ${report.revision})` : ''}`,
      });
    });
  } catch (error) {
    await Promise.all(keys.map((key) => deleteStoredFile(key)));
    throw error;
  }
}

// ===========================================================================
// Validation, contestation, avis (client)
// ===========================================================================

async function getOwnedRequest(requesterId: string, reference: string) {
  const request = await prisma.serviceRequest.findFirst({
    where: { reference, requesterId },
    include: { equipment: { include: { type: true } } },
  });
  if (!request) throw new CareError('Demande introuvable.', 404);
  return request;
}

/**
 * Validation par le client : le carnet est enrichi (dernier entretien de
 * l'équipement, échéance suivante) et l'avis devient possible.
 */
export async function validateIntervention(requesterId: string, reference: string, comment?: string) {
  const request = await getOwnedRequest(requesterId, reference);
  const actor: CareActor = { type: 'CLIENT', accountId: requesterId };
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const report = await tx.interventionReport.findFirst({
      where: { requestId: request.id },
      orderBy: { revision: 'desc' },
    });
    if (!report) throw new CareError('Aucun rapport à valider.', 409);
    await transitionRequest(tx, request, 'VALIDATED', actor, {
      reason: 'Intervention validée par le client',
      data: { validatedAt: now },
    });
    await tx.interventionReport.update({
      where: { id: report.id },
      data: { clientDecision: 'CONFIRMED', clientComment: comment || null, decidedAt: now },
    });

    const linkedTasks = await tx.maintenanceTask.findMany({
      where: { requestId: request.id, status: { in: ['TODO', 'PLANNED'] } },
    });
    if (request.equipment) {
      await tx.equipment.update({ where: { id: request.equipment.id }, data: { lastServiceAt: now } });
    }
    const frequency =
      request.equipment?.frequencyMonths ?? request.equipment?.type?.defaultFrequencyMonths ?? null;

    for (const task of linkedTasks) {
      await tx.maintenanceTask.update({
        where: { id: task.id },
        data: { status: 'DONE', completedAt: now },
      });
      const months = task.frequencyMonths ?? frequency;
      const next = report.nextMaintenanceAt ?? (months ? addMonths(now, months) : null);
      if (next) {
        await tx.maintenanceTask.create({
          data: {
            propertyId: task.propertyId,
            equipmentId: task.equipmentId,
            title: task.title,
            frequencyMonths: task.frequencyMonths,
            recommendation: task.recommendation,
            dueAt: next,
          },
        });
      }
    }
    if (linkedTasks.length === 0 && report.nextMaintenanceAt && request.equipment) {
      await tx.maintenanceTask.create({
        data: {
          propertyId: request.propertyId,
          equipmentId: request.equipment.id,
          title: `Entretien recommandé — ${request.equipment.name}`,
          frequencyMonths: frequency,
          recommendation: report.recommendations,
          dueAt: report.nextMaintenanceAt,
        },
      });
    }
  });
}

export async function contestIntervention(requesterId: string, reference: string, reason: string) {
  if (!reason || reason.length < 5) throw new CareError('Expliquez le motif de la contestation.', 400);
  const request = await getOwnedRequest(requesterId, reference);
  await prisma.$transaction(async (tx) => {
    const report = await tx.interventionReport.findFirst({
      where: { requestId: request.id },
      orderBy: { revision: 'desc' },
    });
    if (!report) throw new CareError('Aucun rapport à contester.', 409);
    await transitionRequest(tx, request, 'DISPUTED', { type: 'CLIENT', accountId: requesterId }, {
      reason: `Contestation : ${reason}`,
    });
    await tx.interventionReport.update({
      where: { id: report.id },
      data: { clientDecision: 'CONTESTED', clientComment: reason, decidedAt: new Date() },
    });
  });
}

export async function cancelRequestByClient(requesterId: string, reference: string, reason: string) {
  const request = await getOwnedRequest(requesterId, reference);
  await cancelRequest(request, { type: 'CLIENT', accountId: requesterId }, reason || 'Annulée par le client');
}

export async function cancelRequest(
  request: { id: string; status: RequestStatus },
  actor: CareActor,
  reason: string,
) {
  await prisma.$transaction(async (tx) => {
    await transitionRequest(tx, request, 'CANCELLED', actor, {
      reason,
      data: { cancelledAt: new Date() },
    });
    await releaseOpenItems(tx, request.id, 'Demande annulée');
    // Les entretiens planifiés via cette demande redeviennent « à prévoir ».
    await tx.maintenanceTask.updateMany({
      where: { requestId: request.id, status: 'PLANNED' },
      data: { status: 'TODO', requestId: null },
    });
  });
}

type ReviewInput = z.infer<typeof reviewSchema>;

export async function submitReview(requesterId: string, reference: string, input: ReviewInput) {
  const request = await getOwnedRequest(requesterId, reference);
  if (request.status !== 'VALIDATED' && request.status !== 'CLOSED') {
    throw new CareError('L’avis est possible une fois l’intervention validée.', 409);
  }
  try {
    await prisma.review.create({
      data: { requestId: request.id, authorId: requesterId, ...input, comment: input.comment ?? null },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CareError('Vous avez déjà donné votre avis sur cette intervention.', 409);
    }
    throw error;
  }
}

// ===========================================================================
// Actions administratives génériques
// ===========================================================================

export const ADMIN_MANUAL_TRANSITIONS: RequestStatus[] = [
  'SEARCHING',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'CLOSED',
  'CANCELLED',
];

export async function adminTransition(
  adminId: string,
  requestId: string,
  to: RequestStatus,
  reason: string,
) {
  if (!ADMIN_MANUAL_TRANSITIONS.includes(to)) throw new CareError('Action non disponible.', 400);
  const request = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new CareError('Demande introuvable.', 404);
  const actor: CareActor = { type: 'ADMIN', adminId };
  if (to === 'CANCELLED') {
    await cancelRequest(request, actor, reason || 'Annulée par Kerplus');
    return;
  }
  if (to === 'SEARCHING' && request.status !== 'SUBMITTED') {
    await withdrawAssignment(adminId, requestId, reason || 'Retrait du prestataire');
    return;
  }
  await prisma.$transaction((tx) =>
    transitionRequest(tx, request, to, actor, {
      reason: reason || null,
      data: to === 'CLOSED' ? { closedAt: new Date() } : {},
    }),
  );
}

/** Durée de validité par défaut proposée dans le formulaire de devis. */
export async function defaultQuoteValidityDays(): Promise<number> {
  return getSettingInt(SETTING_KEYS.CARE_QUOTE_VALIDITY_DAYS, 15);
}

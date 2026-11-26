import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDatabase, seedReferentials } from './helpers';
import { createClientAccount, createProviderAccount } from '@/lib/care/services/accounts';
import {
  completeTask,
  createEquipment,
  createProperty,
  getPropertyNotebook,
  linkOrderToProperty,
  listTasks,
} from '@/lib/care/services/properties';
import {
  acceptQuote,
  adminTransition,
  advanceOnSite,
  assignProvider,
  cancelAppointment,
  cancelRequestByClient,
  confirmAppointment,
  contestIntervention,
  createQuote,
  createServiceRequest,
  getClientRequest,
  getProviderMission,
  proposeAppointment,
  refuseQuote,
  respondToAssignment,
  submitReport,
  submitReview,
  validateIntervention,
} from '@/lib/care/services/requests';
import { computeIndicators, eligibleProviders } from '@/lib/care/services/admin';
import { CareError } from '@/lib/care/errors';
import { TransitionError } from '@/lib/care/workflow';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

function photo(name = 'fuite.jpg') {
  return new File([JPEG], name, { type: 'image/jpeg' });
}

function inDays(days: number): Date {
  const date = new Date(Date.now() + days * 24 * 3600 * 1000);
  return new Date(`${date.toISOString().slice(0, 10)}T12:00:00.000Z`);
}

const quoteInput = {
  lines: [{ label: 'Gaz réfrigérant', quantity: 1, unitPrice: 15_000 }],
  travelFee: 3_000,
  diagnosticFee: 0,
  laborAmount: 20_000,
  otherFees: 0,
  discountAmount: 0,
  taxAmount: 0,
  validityDays: 15,
};

interface World {
  adminId: string;
  clientId: string;
  otherClientId: string;
  provider: { accountId: string; providerId: string };
  otherProvider: { accountId: string; providerId: string };
  propertyId: string;
  equipmentId: string;
  categoryId: string;
}

async function buildWorld(): Promise<World> {
  const { adminId } = await seedReferentials();
  const category = await prisma.careCategory.create({
    data: { slug: 'climatisation', name: 'Climatisation', displayOrder: 1 },
  });
  await prisma.careCategory.create({
    data: { slug: 'plomberie', name: 'Plomberie', displayOrder: 2 },
  });
  const type = await prisma.equipmentType.create({
    data: {
      slug: 'climatiseur',
      name: 'Climatiseur',
      categoryId: category.id,
      defaultFrequencyMonths: 6,
      recommendation: 'Nettoyage des filtres.',
    },
  });

  const client = await createClientAccount({
    name: 'Awa Ndiaye',
    email: 'awa@example.com',
    phone: '+221771234567',
    password: 'motdepasse1',
    consent: true,
  });
  const other = await createClientAccount({
    name: 'Moussa Fall',
    email: 'moussa@example.com',
    phone: '+221781234567',
    password: 'motdepasse1',
    consent: true,
  });

  const providerInput = {
    name: 'Ibrahima Sarr',
    email: 'froid@example.com',
    phone: '+221761234567',
    specialties: ['climatisation'],
    zones: ['Dakar'],
  };
  const providerAccount = await createProviderAccount(providerInput, 'Temporaire123');
  const otherAccount = await createProviderAccount(
    { ...providerInput, name: 'Autre Technicien', email: 'autre@example.com' },
    'Temporaire123',
  );
  await prisma.providerProfile.updateMany({ data: { verificationStatus: 'VERIFIED' } });

  const property = await createProperty(client.id, {
    name: 'Villa Ouakam',
    type: 'VILLA',
    commune: 'Dakar',
    quartier: 'Ouakam',
    landmark: 'Près de la mosquée',
    address: 'Rue OK-12',
  });
  const equipment = await createEquipment(client.id, property.id, {
    typeId: type.id,
    name: 'Climatiseur salon',
    quantity: 1,
    lastServiceAt: new Date('2026-01-15T12:00:00Z'),
  });

  return {
    adminId,
    clientId: client.id,
    otherClientId: other.id,
    provider: { accountId: providerAccount.id, providerId: providerAccount.providerProfile!.id },
    otherProvider: { accountId: otherAccount.id, providerId: otherAccount.providerProfile!.id },
    propertyId: property.id,
    equipmentId: equipment.id,
    categoryId: category.id,
  };
}

async function submitRequest(world: World, overrides: Record<string, unknown> = {}) {
  return createServiceRequest(
    world.clientId,
    {
      idempotencyKey: randomUUID(),
      propertyId: world.propertyId,
      categoryId: world.categoryId,
      equipmentId: world.equipmentId,
      description: 'Le climatiseur du salon ne refroidit plus.',
      kind: 'QUICK_REPAIR',
      safetyAcknowledged: false,
      ...overrides,
    } as never,
    [photo()],
  );
}

describe('Kër Care — parcours complet', () => {
  let world: World;

  beforeEach(async () => {
    await resetDatabase();
    world = await buildWorld();
  });

  it('crée la première échéance de maintenance à partir du type d’équipement', async () => {
    const tasks = await listTasks(world.clientId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dueAt.toISOString()).toBe('2026-07-15T12:00:00.000Z');
    expect(tasks[0].equipmentId).toBe(world.equipmentId);
  });

  it('déroule demande → affectation → devis → rendez-vous → rapport → validation → avis', async () => {
    const { reference, created } = await submitRequest(world);
    expect(created).toBe(true);
    expect(reference).toMatch(/^KP-DEP-\d{8}-/);

    const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } });
    await assignProvider(world.adminId, request.id, world.provider.providerId);
    await respondToAssignment(world.provider, reference, true);

    const quote = await createQuote(world.provider, reference, quoteInput);
    expect(quote.totalAmount).toBe(38_000);
    await acceptQuote(world.clientId, quote.id);

    const appointment = await proposeAppointment(world.provider, reference, {
      type: 'INTERVENTION',
      date: inDays(3),
      startTime: '09:00',
      durationMinutes: 120,
      fee: 0,
    });
    await confirmAppointment(world.clientId, appointment.id);

    await advanceOnSite(world.provider, reference, 'ARRIVED');
    await advanceOnSite(world.provider, reference, 'IN_PROGRESS');
    await submitReport(
      world.provider,
      reference,
      {
        diagnostic: 'Filtres encrassés, manque de gaz.',
        workDone: 'Nettoyage complet et recharge de gaz.',
        nextMaintenanceAt: inDays(180),
      },
      { before: [photo('avant.jpg')], after: [photo('apres.jpg')] },
    );

    await validateIntervention(world.clientId, reference);
    await submitReview(world.clientId, reference, { rating: 5, punctuality: 5 });
    await adminTransition(world.adminId, request.id, 'CLOSED', 'Clôture');

    const detail = await getClientRequest(world.clientId, reference);
    expect(detail.status).toBe('CLOSED');
    expect(detail.reports[0].approvedCost).toBe(38_000);
    expect(detail.reports[0].clientDecision).toBe('CONFIRMED');
    expect(detail.reports[0].attachments).toHaveLength(2);
    expect(detail.review?.rating).toBe(5);
    expect(detail.events.map((event) => event.toStatus)).toEqual(
      expect.arrayContaining([
        'SUBMITTED',
        'ASSIGNED',
        'ACCEPTED',
        'QUOTE_SENT',
        'QUOTE_ACCEPTED',
        'SCHEDULED',
        'ARRIVED',
        'IN_PROGRESS',
        'WORK_DONE',
        'VALIDATED',
        'CLOSED',
      ]),
    );
    expect(detail.events.every((event) => event.createdAt instanceof Date)).toBe(true);

    // Le carnet est enrichi : dernier entretien mis à jour, échéance recommandée créée.
    const notebook = await getPropertyNotebook(world.clientId, world.propertyId);
    const equipment = notebook.equipments.find((item) => item.id === world.equipmentId)!;
    expect(equipment.lastServiceAt).not.toBeNull();
    expect(notebook.requests[0].reference).toBe(reference);
    expect(notebook.tasks.some((task) => task.title.startsWith('Entretien recommandé'))).toBe(true);

    // Un seul avis par intervention.
    await expect(submitReview(world.clientId, reference, { rating: 3 })).rejects.toThrow(CareError);

    const indicators = await computeIndicators(30);
    expect(indicators.received).toBe(1);
    expect(indicators.quoteAcceptanceRate).toBe(100);
    expect(indicators.averageRating).toBe(5);
  });

  it('est idempotente : une double soumission ne crée qu’une demande', async () => {
    const key = randomUUID();
    const first = await submitRequest(world, { idempotencyKey: key });
    const second = await submitRequest(world, { idempotencyKey: key });
    const [a, b] = await Promise.all([
      submitRequest(world, { idempotencyKey: key }),
      submitRequest(world, { idempotencyKey: key }),
    ]);
    expect(second.created).toBe(false);
    expect(new Set([first.reference, second.reference, a.reference, b.reference]).size).toBe(1);
    expect(await prisma.serviceRequest.count()).toBe(1);
  });

  it('cloisonne les données entre comptes', async () => {
    const { reference } = await submitRequest(world);
    await expect(getClientRequest(world.otherClientId, reference)).rejects.toThrow(CareError);
    await expect(getPropertyNotebook(world.otherClientId, world.propertyId)).rejects.toThrow(
      CareError,
    );
    await expect(
      createServiceRequest(
        world.otherClientId,
        {
          idempotencyKey: randomUUID(),
          propertyId: world.propertyId,
          categoryId: world.categoryId,
          description: 'Tentative sur le logement d’un autre client.',
          kind: 'PLANNED',
          safetyAcknowledged: false,
        },
        [],
      ),
    ).rejects.toThrow('Logement introuvable');
    // Un prestataire non affecté ne voit pas la demande.
    await expect(getProviderMission(world.provider.providerId, reference)).rejects.toThrow(
      CareError,
    );
  });

  it('masque adresse et coordonnées tant que la mission n’est pas acceptée', async () => {
    const { reference } = await submitRequest(world);
    const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } });
    await assignProvider(world.adminId, request.id, world.provider.providerId);

    const pending = await getProviderMission(world.provider.providerId, reference);
    expect(pending.property.address).toBeNull();
    expect(pending.property.landmark).toBeNull();
    expect(pending.client).toBeNull();

    await respondToAssignment(world.provider, reference, true);
    const accepted = await getProviderMission(world.provider.providerId, reference);
    expect(accepted.property.address).toBe('Rue OK-12');
    expect(accepted.client?.phone).toBe('+221771234567');
  });

  it('permet la réaffectation après refus et coupe l’accès du prestataire refusant', async () => {
    const { reference } = await submitRequest(world);
    const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } });
    await assignProvider(world.adminId, request.id, world.provider.providerId);
    await expect(respondToAssignment(world.provider, reference, false)).rejects.toThrow('motif');
    await respondToAssignment(world.provider, reference, false, 'Indisponible cette semaine');

    expect((await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } })).status).toBe(
      'SEARCHING',
    );
    await expect(getProviderMission(world.provider.providerId, reference)).rejects.toThrow(
      CareError,
    );

    await assignProvider(world.adminId, request.id, world.otherProvider.providerId);
    await respondToAssignment(world.otherProvider, reference, true);
    expect((await getProviderMission(world.otherProvider.providerId, reference)).accepted).toBe(
      true,
    );
  });

  it('refuse l’affectation d’un prestataire non vérifié ou hors spécialité', async () => {
    const { reference } = await submitRequest(world);
    const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } });
    await prisma.providerProfile.update({
      where: { id: world.otherProvider.providerId },
      data: { verificationStatus: 'PENDING' },
    });
    await expect(
      assignProvider(world.adminId, request.id, world.otherProvider.providerId),
    ).rejects.toThrow(/vérifié/);
    await prisma.providerProfile.update({
      where: { id: world.otherProvider.providerId },
      data: { verificationStatus: 'VERIFIED', specialties: ['plomberie'] },
    });
    await expect(
      assignProvider(world.adminId, request.id, world.otherProvider.providerId),
    ).rejects.toThrow(/catégorie/);
    const eligible = await eligibleProviders('climatisation', 'Dakar');
    expect(eligible[0].id).toBe(world.provider.providerId);
    expect(eligible[0].matchesSpecialty).toBe(true);
  });

  it('verrouille le devis accepté : un supplément exige une nouvelle approbation', async () => {
    const { reference } = await submitRequest(world);
    const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } });
    await assignProvider(world.adminId, request.id, world.provider.providerId);
    await respondToAssignment(world.provider, reference, true);

    const v1 = await createQuote(world.provider, reference, quoteInput);
    await refuseQuote(world.clientId, v1.id, 'Trop cher');
    expect((await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } })).status).toBe(
      'QUOTE_REFUSED',
    );

    const v2 = await createQuote(world.provider, reference, { ...quoteInput, laborAmount: 15_000 });
    expect(v2.version).toBe(2);
    await acceptQuote(world.clientId, v2.id);
    await expect(acceptQuote(world.clientId, v2.id)).rejects.toThrow(CareError);

    const appointment = await proposeAppointment(world.provider, reference, {
      type: 'INTERVENTION',
      date: inDays(2),
      startTime: '10:00',
      durationMinutes: 60,
      fee: 0,
    });
    await confirmAppointment(world.clientId, appointment.id);
    await advanceOnSite(world.provider, reference, 'ARRIVED');
    await advanceOnSite(world.provider, reference, 'IN_PROGRESS');

    // Supplément en cours d'intervention.
    const v3 = await createQuote(world.provider, reference, { ...quoteInput, laborAmount: 25_000 });
    const lockedV2 = await prisma.quote.findUniqueOrThrow({ where: { id: v2.id } });
    expect(lockedV2.status).toBe('ACCEPTED');
    expect(lockedV2.totalAmount).toBe(33_000);
    await expect(
      submitReport(
        world.provider,
        reference,
        { diagnostic: 'Diagnostic', workDone: 'Travaux faits' },
        { before: [], after: [] },
      ),
    ).rejects.toThrow(/supplément/);

    await acceptQuote(world.clientId, v3.id);
    await submitReport(
      world.provider,
      reference,
      { diagnostic: 'Diagnostic', workDone: 'Travaux faits' },
      { before: [], after: [] },
    );
    const report = await prisma.interventionReport.findFirstOrThrow({
      where: { requestId: request.id },
    });
    expect(report.approvedCost).toBe(43_000);
    expect(await prisma.quote.count({ where: { requestId: request.id } })).toBe(3);
  });

  it('empêche deux rendez-vous incompatibles pour un même prestataire', async () => {
    const first = await submitRequest(world);
    const second = await submitRequest(world, { description: 'Deuxième climatiseur en panne.' });
    for (const { reference } of [first, second]) {
      const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } });
      await assignProvider(world.adminId, request.id, world.provider.providerId);
      await respondToAssignment(world.provider, reference, true);
      const quote = await createQuote(world.provider, reference, quoteInput);
      await acceptQuote(world.clientId, quote.id);
    }
    const slot = {
      type: 'INTERVENTION' as const,
      date: inDays(4),
      startTime: '09:00',
      durationMinutes: 120,
      fee: 0,
    };
    await proposeAppointment(world.provider, first.reference, slot);
    await expect(
      proposeAppointment(world.provider, second.reference, { ...slot, startTime: '10:00' }),
    ).rejects.toThrow(/chevauche/);
    await proposeAppointment(world.provider, second.reference, { ...slot, startTime: '11:00' });
    await expect(
      proposeAppointment(world.provider, second.reference, {
        ...slot,
        date: new Date('2020-01-01T12:00:00Z'),
      }),
    ).rejects.toThrow(/futur/);
  });

  it('gère annulation de rendez-vous, contestation et transitions interdites', async () => {
    const { reference } = await submitRequest(world);
    const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } });
    await assignProvider(world.adminId, request.id, world.provider.providerId);
    await respondToAssignment(world.provider, reference, true);
    // Le client ne peut pas valider une intervention non réalisée.
    await expect(validateIntervention(world.clientId, reference)).rejects.toThrow();
    const quote = await createQuote(world.provider, reference, quoteInput);
    await acceptQuote(world.clientId, quote.id);
    const appointment = await proposeAppointment(world.provider, reference, {
      type: 'INTERVENTION',
      date: inDays(5),
      startTime: '15:00',
      durationMinutes: 60,
      fee: 0,
    });
    await confirmAppointment(world.clientId, appointment.id);
    await cancelAppointment(
      { type: 'CLIENT', accountId: world.clientId },
      appointment.id,
      'Absent ce jour-là',
    );
    expect((await prisma.serviceRequest.findUniqueOrThrow({ where: { reference } })).status).toBe(
      'QUOTE_ACCEPTED',
    );

    const again = await proposeAppointment(world.provider, reference, {
      type: 'INTERVENTION',
      date: inDays(6),
      startTime: '15:00',
      durationMinutes: 60,
      fee: 0,
    });
    await confirmAppointment(world.clientId, again.id);
    // Le client ne peut plus annuler la demande une fois le rendez-vous confirmé.
    await expect(
      cancelRequestByClient(world.clientId, reference, 'Changement d’avis'),
    ).rejects.toThrow(TransitionError);
    await advanceOnSite(world.provider, reference, 'EN_ROUTE');
    await advanceOnSite(world.provider, reference, 'ARRIVED');
    await advanceOnSite(world.provider, reference, 'IN_PROGRESS');
    await submitReport(
      world.provider,
      reference,
      { diagnostic: 'Diagnostic', workDone: 'Travaux' },
      { before: [], after: [] },
    );

    await contestIntervention(world.clientId, reference, 'Le climatiseur fuit toujours.');
    await expect(submitReview(world.clientId, reference, { rating: 1 })).rejects.toThrow(/validée/);
    await adminTransition(world.adminId, request.id, 'IN_PROGRESS', 'Reprise');
    await submitReport(
      world.provider,
      reference,
      { diagnostic: 'Joint changé', workDone: 'Reprise effectuée' },
      { before: [], after: [] },
    );
    const reports = await prisma.interventionReport.findMany({
      where: { requestId: request.id },
      orderBy: { revision: 'asc' },
    });
    expect(reports.map((report) => [report.revision, report.clientDecision])).toEqual([
      [1, 'CONTESTED'],
      [2, 'PENDING'],
    ]);
  });

  it('annule une demande, libère l’entretien planifié et exige les consignes en cas de danger', async () => {
    const [task] = await listTasks(world.clientId);
    const { reference } = await submitRequest(world, {
      maintenanceTaskId: task.id,
      kind: 'PLANNED',
    });
    expect(
      (await prisma.maintenanceTask.findUniqueOrThrow({ where: { id: task.id } })).status,
    ).toBe('PLANNED');
    await cancelRequestByClient(world.clientId, reference, 'Plus nécessaire');
    const released = await prisma.maintenanceTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(released.status).toBe('TODO');
    expect(released.requestId).toBeNull();

    await expect(
      submitRequest(world, { kind: 'EMERGENCY', safetyAcknowledged: false }),
    ).rejects.toThrow(/consignes/);
    await expect(
      submitRequest(world, { kind: 'EMERGENCY', safetyAcknowledged: true }),
    ).resolves.toBeTruthy();
  });

  it('refuse les fichiers déguisés et le rattachement d’une commande d’un tiers', async () => {
    const fake = new File([Buffer.from('<script>alert(1)</script>')], 'photo.jpg', {
      type: 'image/jpeg',
    });
    await expect(
      createServiceRequest(
        world.clientId,
        {
          idempotencyKey: randomUUID(),
          propertyId: world.propertyId,
          categoryId: world.categoryId,
          description: 'Photo piégée en pièce jointe.',
          kind: 'PLANNED',
          safetyAcknowledged: false,
        },
        [fake],
      ),
    ).rejects.toThrow(/format/);
    expect(await prisma.serviceRequest.count()).toBe(0);

    await expect(
      linkOrderToProperty(
        { id: world.clientId, email: 'awa@example.com' },
        world.propertyId,
        'KP-CMD-20260101-ABCD',
      ),
    ).rejects.toThrow(CareError);
  });

  it('clôture un entretien et programme le suivant', async () => {
    const [task] = await listTasks(world.clientId);
    await completeTask(world.clientId, task.id, new Date('2026-11-20T12:00:00Z'));
    const tasks = await listTasks(world.clientId);
    expect(tasks.map((item) => item.status).sort()).toEqual(['DONE', 'TODO']);
    expect(tasks.find((item) => item.status === 'TODO')!.dueAt.toISOString()).toBe(
      '2027-05-20T12:00:00.000Z',
    );
    await expect(completeTask(world.otherClientId, task.id)).rejects.toThrow(CareError);
  });
});

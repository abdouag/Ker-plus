import 'server-only';

import type { AttachmentKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CareError } from '../errors';
import { computeNextDue, addMonths } from '../maintenance';
import { storeFile, validateUpload } from '../storage';
import { CARE_UPLOAD } from '../constants';
import type { equipmentSchema, propertySchema, taskSchema } from '../validation';
import type { z } from 'zod';

/**
 * Logements, équipements, documents et entretiens d'un client.
 * Chaque fonction vérifie l'appartenance de la ressource au compte appelant.
 */

export async function listProperties(ownerId: string, includeArchived = false) {
  return prisma.property.findMany({
    where: { ownerId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ archivedAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: {
        select: {
          equipments: { where: { archivedAt: null } },
          requests: true,
        },
      },
    },
  });
}

/** Charge un logement en vérifiant qu'il appartient au client. */
export async function getOwnedProperty(ownerId: string, propertyId: string) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, ownerId } });
  if (!property) throw new CareError('Logement introuvable.', 404);
  return property;
}

export async function getPropertyNotebook(ownerId: string, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ownerId },
    include: {
      equipments: {
        orderBy: [{ archivedAt: 'asc' }, { createdAt: 'asc' }],
        include: { type: { include: { category: true } } },
      },
      tasks: { orderBy: { dueAt: 'asc' }, include: { equipment: { select: { name: true } } } },
      attachments: {
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      requests: {
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { name: true, slug: true } },
          equipment: { select: { id: true, name: true } },
          quotes: { where: { status: 'ACCEPTED' }, orderBy: { version: 'desc' }, take: 1 },
          reports: { orderBy: { revision: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (!property) throw new CareError('Logement introuvable.', 404);
  return property;
}

type PropertyInput = z.infer<typeof propertySchema>;

export async function createProperty(ownerId: string, input: PropertyInput) {
  const duplicate = await prisma.property.findFirst({
    where: {
      ownerId,
      archivedAt: null,
      name: { equals: input.name, mode: 'insensitive' },
      commune: { equals: input.commune, mode: 'insensitive' },
    },
  });
  if (duplicate) {
    throw new CareError('Un logement portant ce nom existe déjà dans cette commune.', 409);
  }
  return prisma.property.create({ data: { ...input, ownerId } });
}

export async function updateProperty(ownerId: string, propertyId: string, input: PropertyInput) {
  await getOwnedProperty(ownerId, propertyId);
  return prisma.property.update({ where: { id: propertyId }, data: input });
}

export async function setPropertyArchived(ownerId: string, propertyId: string, archived: boolean) {
  await getOwnedProperty(ownerId, propertyId);
  return prisma.property.update({
    where: { id: propertyId },
    data: { archivedAt: archived ? new Date() : null },
  });
}

/**
 * Rattache une commande Kerplus (projet de construction) au logement.
 * La commande doit appartenir à un client portant la même adresse email que
 * le compte : aucune donnée d'un tiers ne peut être rattachée.
 */
export async function linkOrderToProperty(
  owner: { id: string; email: string },
  propertyId: string,
  orderReference: string,
) {
  await getOwnedProperty(owner.id, propertyId);
  const reference = orderReference.trim().toUpperCase();
  const order = await prisma.order.findUnique({
    where: { reference },
    select: { reference: true, customer: { select: { email: true } } },
  });
  if (!order || order.customer.email.toLowerCase() !== owner.email.toLowerCase()) {
    throw new CareError(
      'Commande introuvable pour votre adresse email. Vérifiez la référence (KP-CMD-…).',
      404,
    );
  }
  return prisma.property.update({
    where: { id: propertyId },
    data: { linkedOrderReference: order.reference },
  });
}

// ---------------------------------------------------------------------------
// Équipements
// ---------------------------------------------------------------------------

type EquipmentInput = z.infer<typeof equipmentSchema>;

async function resolveFrequency(typeId: string | undefined, own: number | undefined) {
  if (own)
    return {
      frequency: own,
      type: typeId ? await prisma.equipmentType.findUnique({ where: { id: typeId } }) : null,
    };
  if (!typeId) return { frequency: null, type: null };
  const type = await prisma.equipmentType.findUnique({ where: { id: typeId } });
  if (!type || !type.active) throw new CareError('Type d’équipement inconnu.', 400);
  return { frequency: type.defaultFrequencyMonths, type };
}

export async function getOwnedEquipment(ownerId: string, equipmentId: string) {
  const equipment = await prisma.equipment.findFirst({
    where: { id: equipmentId, property: { ownerId } },
  });
  if (!equipment) throw new CareError('Équipement introuvable.', 404);
  return equipment;
}

/** Crée un équipement et, si une fréquence est connue, sa première échéance. */
export async function createEquipment(ownerId: string, propertyId: string, input: EquipmentInput) {
  const property = await getOwnedProperty(ownerId, propertyId);
  if (property.archivedAt) throw new CareError('Ce logement est archivé.', 409);
  const { frequency, type } = await resolveFrequency(input.typeId, input.frequencyMonths);

  return prisma.$transaction(async (tx) => {
    const equipment = await tx.equipment.create({
      data: {
        propertyId,
        typeId: type?.id ?? null,
        name: input.name,
        location: input.location,
        quantity: input.quantity,
        brand: input.brand,
        model: input.model,
        installedAt: input.installedAt,
        warrantyUntil: input.warrantyUntil,
        lastServiceAt: input.lastServiceAt,
        frequencyMonths: input.frequencyMonths ?? null,
        notes: input.notes,
      },
    });
    const dueAt = computeNextDue(frequency, input);
    if (dueAt) {
      await tx.maintenanceTask.create({
        data: {
          propertyId,
          equipmentId: equipment.id,
          title: `Entretien — ${equipment.name}`,
          frequencyMonths: frequency,
          dueAt,
          recommendation: type?.recommendation ?? null,
        },
      });
    }
    return equipment;
  });
}

export async function updateEquipment(ownerId: string, equipmentId: string, input: EquipmentInput) {
  await getOwnedEquipment(ownerId, equipmentId);
  const { type } = await resolveFrequency(input.typeId, input.frequencyMonths);
  return prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      typeId: type?.id ?? null,
      name: input.name,
      location: input.location ?? null,
      quantity: input.quantity,
      brand: input.brand ?? null,
      model: input.model ?? null,
      installedAt: input.installedAt ?? null,
      warrantyUntil: input.warrantyUntil ?? null,
      lastServiceAt: input.lastServiceAt ?? null,
      frequencyMonths: input.frequencyMonths ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function setEquipmentArchived(
  ownerId: string,
  equipmentId: string,
  archived: boolean,
) {
  await getOwnedEquipment(ownerId, equipmentId);
  return prisma.equipment.update({
    where: { id: equipmentId },
    data: { archivedAt: archived ? new Date() : null },
  });
}

// ---------------------------------------------------------------------------
// Documents du carnet
// ---------------------------------------------------------------------------

export async function addPropertyDocuments(
  ownerId: string,
  propertyId: string,
  files: File[],
  meta: { kind: AttachmentKind; title?: string; equipmentId?: string },
) {
  await getOwnedProperty(ownerId, propertyId);
  if (files.length === 0) throw new CareError('Sélectionnez au moins un fichier.', 400);
  if (meta.equipmentId) {
    const equipment = await getOwnedEquipment(ownerId, meta.equipmentId);
    if (equipment.propertyId !== propertyId) throw new CareError('Équipement introuvable.', 404);
  }
  const uploads = await Promise.all(
    files.map((file) => validateUpload(file, CARE_UPLOAD.documentTypes)),
  );
  for (const upload of uploads) {
    const fileKey = await storeFile(upload);
    await prisma.attachment.create({
      data: {
        kind: meta.kind,
        title: meta.title ?? null,
        propertyId,
        equipmentId: meta.equipmentId ?? null,
        uploadedById: ownerId,
        fileKey,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        sizeBytes: upload.buffer.byteLength,
      },
    });
  }
  return uploads.length;
}

/** Archive un document : il disparaît du carnet mais n'est pas détruit. */
export async function archivePropertyDocument(ownerId: string, attachmentId: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, property: { ownerId }, requestId: null, reportId: null },
  });
  if (!attachment) throw new CareError('Document introuvable.', 404);
  return prisma.attachment.update({
    where: { id: attachmentId },
    data: { archivedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Entretiens
// ---------------------------------------------------------------------------

export async function listTasks(ownerId: string, propertyId?: string) {
  return prisma.maintenanceTask.findMany({
    where: { property: { ownerId, archivedAt: null }, ...(propertyId ? { propertyId } : {}) },
    orderBy: { dueAt: 'asc' },
    include: {
      property: { select: { id: true, name: true } },
      equipment: { select: { id: true, name: true } },
      request: { select: { reference: true, status: true } },
    },
  });
}

type TaskInput = z.infer<typeof taskSchema>;

export async function createTask(ownerId: string, propertyId: string, input: TaskInput) {
  await getOwnedProperty(ownerId, propertyId);
  if (input.equipmentId) {
    const equipment = await getOwnedEquipment(ownerId, input.equipmentId);
    if (equipment.propertyId !== propertyId) throw new CareError('Équipement introuvable.', 404);
  }
  return prisma.maintenanceTask.create({
    data: {
      propertyId,
      equipmentId: input.equipmentId ?? null,
      title: input.title,
      dueAt: input.dueAt,
      frequencyMonths: input.frequencyMonths ?? null,
      recommendation: input.recommendation ?? null,
    },
  });
}

async function getOwnedTask(ownerId: string, taskId: string) {
  const task = await prisma.maintenanceTask.findFirst({
    where: { id: taskId, property: { ownerId } },
  });
  if (!task) throw new CareError('Entretien introuvable.', 404);
  return task;
}

export async function postponeTask(ownerId: string, taskId: string, dueAt: Date) {
  const task = await getOwnedTask(ownerId, taskId);
  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    throw new CareError('Cet entretien est déjà clôturé.', 409);
  }
  return prisma.maintenanceTask.update({ where: { id: taskId }, data: { dueAt } });
}

export async function cancelTask(ownerId: string, taskId: string) {
  const task = await getOwnedTask(ownerId, taskId);
  if (task.status === 'DONE') throw new CareError('Cet entretien est déjà effectué.', 409);
  return prisma.maintenanceTask.update({ where: { id: taskId }, data: { status: 'CANCELLED' } });
}

/**
 * Marque un entretien comme effectué, met à jour l'équipement et, si une
 * fréquence est définie, crée l'échéance suivante.
 */
export async function completeTask(
  ownerId: string,
  taskId: string,
  completedAt: Date = new Date(),
  nextDueAt?: Date | null,
) {
  const task = await getOwnedTask(ownerId, taskId);
  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    throw new CareError('Cet entretien est déjà clôturé.', 409);
  }
  return prisma.$transaction(async (tx) => {
    await tx.maintenanceTask.update({
      where: { id: task.id },
      data: { status: 'DONE', completedAt },
    });
    if (task.equipmentId) {
      await tx.equipment.update({
        where: { id: task.equipmentId },
        data: { lastServiceAt: completedAt },
      });
    }
    const next =
      nextDueAt ?? (task.frequencyMonths ? addMonths(completedAt, task.frequencyMonths) : null);
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
  });
}

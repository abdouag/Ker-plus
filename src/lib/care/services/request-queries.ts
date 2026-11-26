import 'server-only';

import { prisma } from '@/lib/prisma';

/** Données nécessaires au formulaire de demande d'intervention (lecture seule). */
export async function getRequestFormData(ownerId: string) {
  const [properties, categories] = await Promise.all([
    prisma.property.findMany({
      where: { ownerId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        commune: true,
        equipments: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, location: true, type: { select: { categoryId: true } } },
        },
      },
    }),
    prisma.careCategory.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, indicativePriceFrom: true },
    }),
  ]);
  return { properties, categories };
}

/** Entretien « à prévoir » du client, pour préremplir une demande. */
export async function getOwnedTodoTask(ownerId: string, taskId: string) {
  return prisma.maintenanceTask.findFirst({
    where: { id: taskId, status: 'TODO', property: { ownerId, archivedAt: null } },
    select: { id: true, title: true, propertyId: true, equipmentId: true },
  });
}

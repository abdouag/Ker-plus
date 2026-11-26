import 'server-only';

import { prisma } from '@/lib/prisma';
import { ACTIVE_STATUSES } from '../workflow';

/**
 * Lectures complémentaires pour les pages publiques et l'espace client
 * Kër Care. Aucune écriture ici : les mutations passent par les actions.
 */

export async function listActiveCategories() {
  return prisma.careCategory.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function listActivePlans() {
  return prisma.carePlan.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: 'asc' }, { monthlyPrice: 'asc' }],
  });
}

export async function listActiveEquipmentTypes() {
  return prisma.equipmentType.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, defaultFrequencyMonths: true, recommendation: true },
  });
}

/** Logements actifs du client avec leurs équipements actifs (formulaires). */
export async function listPropertiesWithEquipments(ownerId: string) {
  return prisma.property.findMany({
    where: { ownerId, archivedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      equipments: {
        where: { archivedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
      },
    },
  });
}

/** Interventions en cours du client (tableau de bord). */
export async function listActiveRequests(requesterId: string, propertyId?: string) {
  return prisma.serviceRequest.findMany({
    where: {
      requesterId,
      status: { in: ACTIVE_STATUSES },
      ...(propertyId ? { propertyId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      property: { select: { id: true, name: true } },
      category: { select: { name: true } },
      equipment: { select: { name: true } },
      appointments: {
        where: { status: { in: ['PROPOSED', 'CONFIRMED'] } },
        orderBy: { startsAt: 'asc' },
        take: 1,
      },
    },
  });
}

/** Zones (CityZone) de l'estimateur, pour la passerelle rénovation. */
export async function listEstimatorCities() {
  return prisma.cityZone.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
    select: { id: true, name: true, slug: true },
  });
}

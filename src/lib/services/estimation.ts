import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeEstimation } from '@/lib/estimation/calculator';
import { generateUniqueReference } from '@/lib/reference';
import { getRangePercentage } from '@/lib/settings';
import type { EstimationInputPayload } from '@/lib/validation/schemas';

/**
 * Recalcul serveur d'une estimation.
 *
 * Le navigateur ne transmet que des identifiants et une surface : les prix et
 * coefficients sont TOUJOURS relus en base. Aucun montant venant du client
 * n'est accepté.
 */

export class EstimationReferentialError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'EstimationReferentialError';
  }
}

export interface EstimationSnapshot {
  projectTypeId: string;
  projectTypeNameSnapshot: string;
  projectCoefficientSnapshot: number;
  surface: number;
  cityZoneId: string;
  cityNameSnapshot: string;
  cityCoefficientSnapshot: number;
  finishLevelId: string;
  finishNameSnapshot: string;
  pricePerSquareMeterSnapshot: number;
  rangePercentageSnapshot: number;
  estimatedTotal: number;
  estimatedMinimum: number;
  estimatedMaximum: number;
}

/**
 * Calcule l'estimation à partir des référentiels actifs et fige l'ensemble des
 * valeurs utilisées (instantanés), afin qu'une évolution tarifaire ultérieure
 * ne modifie jamais une estimation déjà réalisée.
 */
export async function computeServerEstimation(
  input: EstimationInputPayload,
): Promise<EstimationSnapshot> {
  const [projectType, cityZone, finishLevel, rangePercentage] = await Promise.all([
    prisma.projectType.findUnique({ where: { id: input.projectTypeId } }),
    prisma.cityZone.findUnique({ where: { id: input.cityZoneId } }),
    prisma.finishLevel.findUnique({ where: { id: input.finishLevelId } }),
    getRangePercentage(),
  ]);

  if (!projectType || !projectType.active) {
    throw new EstimationReferentialError('Type de projet indisponible. Actualisez la page.');
  }
  if (!cityZone || !cityZone.active) {
    throw new EstimationReferentialError('Ville ou zone indisponible. Actualisez la page.');
  }
  if (!finishLevel || !finishLevel.active) {
    throw new EstimationReferentialError('Niveau de finition indisponible. Actualisez la page.');
  }

  const result = computeEstimation({
    surface: input.surface,
    pricePerSquareMeter: finishLevel.pricePerSquareMeter,
    cityCoefficient: cityZone.coefficient,
    projectCoefficient: projectType.coefficient,
    rangePercentage,
  });

  return {
    projectTypeId: projectType.id,
    projectTypeNameSnapshot: projectType.name,
    projectCoefficientSnapshot: projectType.coefficient,
    surface: input.surface,
    cityZoneId: cityZone.id,
    cityNameSnapshot: cityZone.name,
    cityCoefficientSnapshot: cityZone.coefficient,
    finishLevelId: finishLevel.id,
    finishNameSnapshot: finishLevel.name,
    pricePerSquareMeterSnapshot: finishLevel.pricePerSquareMeter,
    rangePercentageSnapshot: rangePercentage,
    ...result,
  };
}

export interface PersistSimulationOptions {
  customerId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  /** Client Prisma alternatif (transaction). */
  client?: Prisma.TransactionClient;
}

/** Enregistre une simulation avec une référence unique KP-EST-AAAAMMJJ-XXXX. */
export async function persistSimulation(
  snapshot: EstimationSnapshot,
  options: PersistSimulationOptions = {},
) {
  const db = options.client ?? prisma;
  const reference = await generateUniqueReference('EST', async (candidate) => {
    const existing = await db.simulation.findUnique({
      where: { reference: candidate },
      select: { id: true },
    });
    return existing !== null;
  });

  return db.simulation.create({
    data: {
      reference,
      customerId: options.customerId ?? null,
      projectTypeId: snapshot.projectTypeId,
      projectTypeNameSnapshot: snapshot.projectTypeNameSnapshot,
      projectCoefficientSnapshot: snapshot.projectCoefficientSnapshot,
      surface: snapshot.surface,
      cityZoneId: snapshot.cityZoneId,
      cityNameSnapshot: snapshot.cityNameSnapshot,
      cityCoefficientSnapshot: snapshot.cityCoefficientSnapshot,
      finishLevelId: snapshot.finishLevelId,
      finishNameSnapshot: snapshot.finishNameSnapshot,
      pricePerSquareMeterSnapshot: snapshot.pricePerSquareMeterSnapshot,
      rangePercentageSnapshot: snapshot.rangePercentageSnapshot,
      estimatedTotal: snapshot.estimatedTotal,
      estimatedMinimum: snapshot.estimatedMinimum,
      estimatedMaximum: snapshot.estimatedMaximum,
      ipHash: options.ipHash ?? null,
      userAgent: options.userAgent ?? null,
      utmSource: options.utmSource ?? null,
      utmMedium: options.utmMedium ?? null,
      utmCampaign: options.utmCampaign ?? null,
    },
  });
}

/** Référentiels actifs affichés par l'estimateur public. */
export async function getActiveReferentials() {
  const [projectTypes, cityZones, finishLevels, rangePercentage] = await Promise.all([
    prisma.projectType.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.cityZone.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.finishLevel.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    getRangePercentage(),
  ]);

  return { projectTypes, cityZones, finishLevels, rangePercentage };
}

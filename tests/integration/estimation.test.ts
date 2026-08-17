import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  computeServerEstimation,
  EstimationReferentialError,
  getActiveReferentials,
  persistSimulation,
} from '@/lib/services/estimation';
import { setSetting, SETTING_KEYS } from '@/lib/settings';
import { prisma, resetDatabase, seedReferentials, type SeededReferentials } from './helpers';

let referentials: SeededReferentials;

beforeEach(async () => {
  await resetDatabase();
  referentials = await seedReferentials();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('calcul serveur', () => {
  it('recalcule à partir des référentiels en base', async () => {
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 150,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });

    expect(snapshot.estimatedTotal).toBe(36_300_000);
    expect(snapshot.estimatedMinimum).toBe(32_670_000);
    expect(snapshot.estimatedMaximum).toBe(39_930_000);
    expect(snapshot.pricePerSquareMeterSnapshot).toBe(200_000);
    expect(snapshot.rangePercentageSnapshot).toBe(1000);
  });

  it('utilise la variation de fourchette configurée', async () => {
    await setSetting(SETTING_KEYS.RANGE_PERCENTAGE, '1500');
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 150,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });
    expect(snapshot.rangePercentageSnapshot).toBe(1500);
    expect(snapshot.estimatedMinimum).toBe(Math.round(36_300_000 * 0.85));
  });

  it('refuse un référentiel inconnu ou désactivé', async () => {
    await expect(
      computeServerEstimation({
        projectTypeId: 'inexistant',
        surface: 150,
        cityZoneId: referentials.cityZoneId,
        finishLevelId: referentials.finishLevelId,
      }),
    ).rejects.toBeInstanceOf(EstimationReferentialError);

    await prisma.cityZone.update({
      where: { id: referentials.cityZoneId },
      data: { active: false },
    });

    await expect(
      computeServerEstimation({
        projectTypeId: referentials.projectTypeId,
        surface: 150,
        cityZoneId: referentials.cityZoneId,
        finishLevelId: referentials.finishLevelId,
      }),
    ).rejects.toBeInstanceOf(EstimationReferentialError);
  });

  it('n’expose que les référentiels actifs', async () => {
    await prisma.finishLevel.create({
      data: {
        name: 'Ancien niveau',
        slug: 'ancien',
        pricePerSquareMeter: 120_000,
        active: false,
      },
    });

    const active = await getActiveReferentials();
    expect(active.finishLevels).toHaveLength(1);
    expect(active.finishLevels[0].name).toBe('Standard');
  });
});

describe('enregistrement des simulations', () => {
  it('persiste la simulation avec une référence unique et ses instantanés', async () => {
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 200,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });

    const simulation = await persistSimulation(snapshot, {
      ipHash: 'empreinte-test',
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: 'diaspora-2026',
    });

    expect(simulation.reference).toMatch(/^KP-EST-\d{8}-[A-Z2-9]{4}$/);
    expect(simulation.projectTypeNameSnapshot).toBe('Villa duplex');
    expect(simulation.cityCoefficientSnapshot).toBe(1100);
    expect(simulation.pricePerSquareMeterSnapshot).toBe(200_000);
    expect(simulation.utmSource).toBe('facebook');
    expect(simulation.ipHash).toBe('empreinte-test');
    expect(simulation.customerId).toBeNull();
  });

  it('génère des références distinctes', async () => {
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 150,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });

    const references = new Set<string>();
    for (let index = 0; index < 25; index += 1) {
      const simulation = await persistSimulation(snapshot);
      references.add(simulation.reference);
    }
    expect(references.size).toBe(25);
  });

  it('conserve les valeurs d’origine après une évolution tarifaire', async () => {
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 150,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });
    const simulation = await persistSimulation(snapshot);

    // Hausse du prix au m² et du coefficient de ville après coup.
    await prisma.finishLevel.update({
      where: { id: referentials.finishLevelId },
      data: { pricePerSquareMeter: 260_000 },
    });
    await prisma.cityZone.update({
      where: { id: referentials.cityZoneId },
      data: { coefficient: 1300 },
    });

    const stored = await prisma.simulation.findUniqueOrThrow({ where: { id: simulation.id } });
    expect(stored.pricePerSquareMeterSnapshot).toBe(200_000);
    expect(stored.cityCoefficientSnapshot).toBe(1100);
    expect(stored.estimatedTotal).toBe(36_300_000);

    // Une nouvelle estimation utilise bien les nouvelles valeurs.
    const updated = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 150,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });
    expect(updated.estimatedTotal).toBe(Math.round(150 * 260_000 * 1.3 * 1.1));
  });
});

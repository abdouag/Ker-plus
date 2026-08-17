import { execFileSync } from 'node:child_process';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { computeServerEstimation, persistSimulation } from '@/lib/services/estimation';
import { countReferentialUsage, removeReferential } from '@/lib/services/referentials';
import {
  getAllSettings,
  getPremiumReportPrice,
  getRangePercentage,
  getReportDeliveryHours,
  getSettingList,
  setSetting,
  SETTING_KEYS,
} from '@/lib/settings';
import { hasRole } from '@/lib/auth/guard';
import { prisma, resetDatabase, seedReferentials, type SeededReferentials } from './helpers';

let referentials: SeededReferentials;

beforeEach(async () => {
  await resetDatabase();
  referentials = await seedReferentials();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('protection des référentiels utilisés', () => {
  it('supprime un élément jamais utilisé', async () => {
    const unused = await prisma.cityZone.create({
      data: { name: 'Ziguinchor', slug: 'ziguinchor', coefficient: 950 },
    });

    const result = await removeReferential('cityZone', unused.id, referentials.adminId);
    expect(result.deleted).toBe(true);
    expect(await prisma.cityZone.findUnique({ where: { id: unused.id } })).toBeNull();
  });

  it('désactive au lieu de supprimer un élément déjà utilisé', async () => {
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 150,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });
    const simulation = await persistSimulation(snapshot);

    expect(await countReferentialUsage('finishLevel', referentials.finishLevelId)).toBe(1);

    const result = await removeReferential(
      'finishLevel',
      referentials.finishLevelId,
      referentials.adminId,
    );
    expect(result.deleted).toBe(false);
    expect(result.deactivated).toBe(true);

    const finish = await prisma.finishLevel.findUniqueOrThrow({
      where: { id: referentials.finishLevelId },
    });
    expect(finish.active).toBe(false);

    // La simulation historique conserve son instantané intact.
    const stored = await prisma.simulation.findUniqueOrThrow({ where: { id: simulation.id } });
    expect(stored.finishNameSnapshot).toBe('Standard');
    expect(stored.pricePerSquareMeterSnapshot).toBe(200_000);
  });
});

describe('paramètres applicatifs', () => {
  it('expose les valeurs par défaut puis les valeurs personnalisées', async () => {
    expect(await getPremiumReportPrice()).toBe(50_000);
    expect(await getRangePercentage()).toBe(1000);
    expect(await getReportDeliveryHours()).toBe(48);

    await setSetting(SETTING_KEYS.PREMIUM_REPORT_PRICE, '65000');
    await setSetting(SETTING_KEYS.REPORT_DELIVERY_HOURS, '72');

    expect(await getPremiumReportPrice()).toBe(65_000);
    expect(await getReportDeliveryHours()).toBe(72);
  });

  it('lit les listes JSON (exclusions, facteurs de variation)', async () => {
    const exclusions = await getSettingList(SETTING_KEYS.EXCLUSIONS);
    expect(exclusions.length).toBeGreaterThan(3);
    expect(exclusions.join(' ')).toMatch(/terrain/i);

    await setSetting(SETTING_KEYS.EXCLUSIONS, JSON.stringify(['Poste A', 'Poste B']));
    expect(await getSettingList(SETTING_KEYS.EXCLUSIONS)).toEqual(['Poste A', 'Poste B']);
  });

  it('complète les clés manquantes par leurs valeurs par défaut', async () => {
    await prisma.appSetting.deleteMany({ where: { key: SETTING_KEYS.CALL_DURATION_MINUTES } });
    const settings = await getAllSettings();
    expect(settings.get(SETTING_KEYS.CALL_DURATION_MINUTES)).toBe('20');
  });
});

describe('rôles administrateur', () => {
  it('hiérarchise correctement les rôles', () => {
    const viewer = { id: '1', name: 'V', email: 'v@k.sn', role: 'VIEWER' as const, active: true };
    const manager = { ...viewer, role: 'MANAGER' as const };
    const admin = { ...viewer, role: 'ADMIN' as const };

    expect(hasRole(viewer, 'VIEWER')).toBe(true);
    expect(hasRole(viewer, 'MANAGER')).toBe(false);
    expect(hasRole(manager, 'MANAGER')).toBe(true);
    expect(hasRole(manager, 'ADMIN')).toBe(false);
    expect(hasRole(admin, 'ADMIN')).toBe(true);
  });
});

describe('seed', () => {
  it('peut être exécuté plusieurs fois sans créer de doublon', async () => {
    await resetDatabase();

    const runSeed = () =>
      execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
        env: {
          ...process.env,
          DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
          ADMIN_EMAIL: 'seed-admin@kerplus.sn',
          ADMIN_PASSWORD: 'MotDePasseSeed2026',
        },
        encoding: 'utf8',
        stdio: 'pipe',
      });

    runSeed();
    const first = {
      projectTypes: await prisma.projectType.count(),
      cityZones: await prisma.cityZone.count(),
      finishLevels: await prisma.finishLevel.count(),
      settings: await prisma.appSetting.count(),
      admins: await prisma.adminUser.count(),
    };

    expect(first.projectTypes).toBe(5);
    expect(first.cityZones).toBe(8);
    expect(first.finishLevels).toBe(3);
    expect(first.admins).toBe(1);

    // Un ajustement tarifaire fait par Kerplus ne doit pas être écrasé.
    await prisma.finishLevel.update({
      where: { slug: 'standard' },
      data: { pricePerSquareMeter: 215_000 },
    });

    runSeed();

    expect({
      projectTypes: await prisma.projectType.count(),
      cityZones: await prisma.cityZone.count(),
      finishLevels: await prisma.finishLevel.count(),
      settings: await prisma.appSetting.count(),
      admins: await prisma.adminUser.count(),
    }).toEqual(first);

    const standard = await prisma.finishLevel.findUniqueOrThrow({ where: { slug: 'standard' } });
    expect(standard.pricePerSquareMeter).toBe(215_000);
  }, 120_000);
});

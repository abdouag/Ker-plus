import { PrismaClient } from '@prisma/client';
import { SETTING_DEFINITIONS } from '@/lib/settings/definitions';

export const prisma = new PrismaClient();

/** Vide toutes les tables métier entre deux tests. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, payment_events, payments, report_items, reports,
      consultation_calls, orders, simulations, customers,
      project_types, city_zones, finish_levels, app_settings, admin_users
    RESTART IDENTITY CASCADE
  `);
}

export interface SeededReferentials {
  projectTypeId: string;
  projectTypeCoefficient: number;
  cityZoneId: string;
  cityCoefficient: number;
  finishLevelId: string;
  pricePerSquareMeter: number;
  adminId: string;
}

/** Jeu de données minimal reproduisant le seed de production. */
export async function seedReferentials(): Promise<SeededReferentials> {
  const [projectType, cityZone, finishLevel, admin] = await Promise.all([
    prisma.projectType.create({
      data: {
        name: 'Villa duplex',
        slug: 'villa-duplex',
        coefficient: 1100,
        displayOrder: 1,
        description: 'Villa sur deux niveaux.',
      },
    }),
    prisma.cityZone.create({
      data: { name: 'Dakar', slug: 'dakar', coefficient: 1100, displayOrder: 1 },
    }),
    prisma.finishLevel.create({
      data: {
        name: 'Standard',
        slug: 'standard',
        pricePerSquareMeter: 200_000,
        displayOrder: 2,
        description: 'Bon rapport qualité-prix.',
      },
    }),
    prisma.adminUser.create({
      data: {
        name: 'Testeur Kerplus',
        email: 'test-admin@kerplus.sn',
        passwordHash: 'hash-de-test',
        role: 'ADMIN',
      },
    }),
  ]);

  await prisma.appSetting.createMany({
    data: SETTING_DEFINITIONS.map((definition) => ({
      key: definition.key,
      value: definition.defaultValue,
      type: definition.type,
      label: definition.label,
      group: definition.group,
    })),
  });

  return {
    projectTypeId: projectType.id,
    projectTypeCoefficient: projectType.coefficient,
    cityZoneId: cityZone.id,
    cityCoefficient: cityZone.coefficient,
    finishLevelId: finishLevel.id,
    pricePerSquareMeter: finishLevel.pricePerSquareMeter,
    adminId: admin.id,
  };
}

/** Charge utile de commande valide, prête à être ajustée par test. */
export function orderPayload(
  referentials: SeededReferentials,
  overrides: Record<string, unknown> = {},
) {
  return {
    projectTypeId: referentials.projectTypeId,
    surface: 150,
    cityZoneId: referentials.cityZoneId,
    finishLevelId: referentials.finishLevelId,
    firstName: 'Awa',
    lastName: 'Ndiaye',
    phone: '+221771234567',
    whatsappSameAsPhone: true,
    whatsapp: '',
    email: 'awa.ndiaye@example.com',
    city: 'Dakar',
    comment: 'Terrain déjà acquis à Yoff.',
    acceptTerms: true as const,
    consentData: true as const,
    ...overrides,
  };
}

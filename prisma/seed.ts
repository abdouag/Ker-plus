/**
 * Seed idempotent — peut être exécuté autant de fois que nécessaire.
 *
 * Insère les référentiels initiaux (types de projets, villes, finitions), les
 * paramètres applicatifs et, si ADMIN_PASSWORD est fourni, un compte
 * administrateur. Aucun mot de passe n'est stocké dans le dépôt.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { SETTING_DEFINITIONS } from '../src/lib/settings/definitions';
import {
  DEFAULT_CARE_CATEGORIES,
  DEFAULT_CARE_PLANS,
  DEFAULT_EQUIPMENT_TYPES,
} from '../src/lib/care/catalog';

loadEnv();

const prisma = new PrismaClient();

const PROJECT_TYPES = [
  {
    slug: 'maison-individuelle',
    name: 'Maison individuelle',
    description: 'Construction de plain-pied ou à un niveau, usage résidentiel familial.',
    coefficient: 1000,
    displayOrder: 1,
  },
  {
    slug: 'villa-duplex',
    name: 'Villa duplex',
    description: 'Villa sur deux niveaux avec escalier intérieur et volumes plus complexes.',
    coefficient: 1100,
    displayOrder: 2,
  },
  {
    slug: 'immeuble-r1',
    name: 'Immeuble R+1',
    description: 'Bâtiment de deux niveaux, à usage résidentiel ou mixte.',
    coefficient: 1150,
    displayOrder: 3,
  },
  {
    slug: 'immeuble-r2',
    name: 'Immeuble R+2',
    description: 'Bâtiment de trois niveaux, structure renforcée.',
    coefficient: 1200,
    displayOrder: 4,
  },
  {
    slug: 'immeuble-r3',
    name: 'Immeuble R+3',
    description: 'Bâtiment de quatre niveaux, contraintes structurelles importantes.',
    coefficient: 1250,
    displayOrder: 5,
  },
];

const CITY_ZONES = [
  { slug: 'dakar', name: 'Dakar', coefficient: 1100, displayOrder: 1 },
  { slug: 'thies', name: 'Thiès', coefficient: 1000, displayOrder: 2 },
  { slug: 'mbour', name: 'Mbour', coefficient: 1000, displayOrder: 3 },
  { slug: 'saly', name: 'Saly', coefficient: 1000, displayOrder: 4 },
  { slug: 'saint-louis', name: 'Saint-Louis', coefficient: 950, displayOrder: 5 },
  { slug: 'kaolack', name: 'Kaolack', coefficient: 950, displayOrder: 6 },
  { slug: 'tambacounda', name: 'Tambacounda', coefficient: 900, displayOrder: 7 },
  { slug: 'autres-regions', name: 'Autres régions', coefficient: 950, displayOrder: 8 },
];

const FINISH_LEVELS = [
  {
    slug: 'economique',
    name: 'Économique',
    description:
      'Matériaux locaux courants, carrelage standard, menuiserie métallique, équipements sanitaires de base.',
    pricePerSquareMeter: 160_000,
    displayOrder: 1,
  },
  {
    slug: 'standard',
    name: 'Standard',
    description:
      'Bon rapport qualité-prix : carrelage de qualité, menuiserie aluminium, faux plafonds partiels, équipements de marque courante.',
    pricePerSquareMeter: 200_000,
    displayOrder: 2,
  },
  {
    slug: 'haut-standing',
    name: 'Haut standing',
    description:
      'Finitions soignées : matériaux importés, menuiserie aluminium haut de gamme, climatisation, domotique et éclairage architectural.',
    pricePerSquareMeter: 280_000,
    displayOrder: 3,
  },
];

async function seedReferentials(): Promise<void> {
  for (const projectType of PROJECT_TYPES) {
    await prisma.projectType.upsert({
      where: { slug: projectType.slug },
      update: {
        name: projectType.name,
        description: projectType.description,
        displayOrder: projectType.displayOrder,
      },
      create: projectType,
    });
  }

  for (const city of CITY_ZONES) {
    await prisma.cityZone.upsert({
      where: { slug: city.slug },
      update: { name: city.name, displayOrder: city.displayOrder },
      create: city,
    });
  }

  for (const finish of FINISH_LEVELS) {
    await prisma.finishLevel.upsert({
      where: { slug: finish.slug },
      update: {
        name: finish.name,
        description: finish.description,
        displayOrder: finish.displayOrder,
      },
      create: finish,
    });
  }

  console.info(
    `Référentiels : ${PROJECT_TYPES.length} types de projets, ${CITY_ZONES.length} villes, ${FINISH_LEVELS.length} finitions.`,
  );
}

/**
 * Les coefficients et prix ne sont volontairement PAS écrasés lors d'un
 * réamorçage : une valeur ajustée par Kerplus dans l'administration reste en
 * place. Seuls les libellés et descriptions sont rafraîchis.
 */
async function seedSettings(): Promise<void> {
  for (const definition of SETTING_DEFINITIONS) {
    await prisma.appSetting.upsert({
      where: { key: definition.key },
      update: { label: definition.label, group: definition.group, type: definition.type },
      create: {
        key: definition.key,
        value: definition.defaultValue,
        type: definition.type,
        label: definition.label,
        group: definition.group,
      },
    });
  }
  console.info(`Paramètres : ${SETTING_DEFINITIONS.length} clés vérifiées.`);
}

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrateur Kerplus';

  if (!email || !password) {
    console.info(
      'Compte administrateur ignoré (ADMIN_EMAIL / ADMIN_PASSWORD absents). ' +
        'Utilisez `npm run admin:create` pour en créer un.',
    );
    return;
  }

  if (password.length < 12) {
    console.warn('ADMIN_PASSWORD trop court (12 caractères minimum) : compte non créé.');
    return;
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.info(`Compte administrateur déjà présent : ${email} (mot de passe inchangé).`);
    return;
  }

  await prisma.adminUser.create({
    data: {
      email,
      name,
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.info(`Compte administrateur créé : ${email}`);
}

/**
 * Référentiels Kër Care : catégories, types d'équipements (règles d'entretien
 * indicatives) et offres indicatives. Comme pour l'estimateur, les valeurs
 * modifiées depuis l'administration ne sont jamais écrasées.
 */
async function seedCare(): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const [index, category] of DEFAULT_CARE_CATEGORIES.entries()) {
    const row = await prisma.careCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        services: [...category.services],
        displayOrder: index + 1,
      },
    });
    categoryIds.set(category.slug, row.id);
  }
  for (const [index, type] of DEFAULT_EQUIPMENT_TYPES.entries()) {
    await prisma.equipmentType.upsert({
      where: { slug: type.slug },
      update: {},
      create: {
        slug: type.slug,
        name: type.name,
        categoryId: categoryIds.get(type.category) ?? null,
        defaultFrequencyMonths: type.months,
        recommendation: type.recommendation,
        displayOrder: index + 1,
      },
    });
  }
  for (const [index, plan] of DEFAULT_CARE_PLANS.entries()) {
    await prisma.carePlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: {
        slug: plan.slug,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        benefits: [...plan.benefits],
        displayOrder: index + 1,
      },
    });
  }
  console.info(
    `Kër Care : ${DEFAULT_CARE_CATEGORIES.length} catégories, ${DEFAULT_EQUIPMENT_TYPES.length} types d’équipements, ${DEFAULT_CARE_PLANS.length} offres vérifiés.`,
  );
}

async function main(): Promise<void> {
  console.info('Seed Estimateur Kerplus…');
  await seedReferentials();
  await seedSettings();
  await seedCare();
  await seedAdmin();
  console.info('Seed terminé.');
}

main()
  .catch((error) => {
    console.error('Échec du seed :', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

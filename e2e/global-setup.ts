import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { E2E_ADMIN } from '../playwright.config';

loadEnv();

/**
 * Prépare une base propre pour les tests de bout en bout :
 * migrations, purge, données initiales et compte administrateur dédié.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL ou DATABASE_URL doit être défini pour les tests E2E.');
  }

  const env = { ...process.env, DATABASE_URL: databaseUrl };

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs, payment_events, payments, report_items, reports,
      consultation_calls, orders, simulations, customers,
      project_types, city_zones, finish_levels, app_settings, admin_users
    RESTART IDENTITY CASCADE
  `);
  await prisma.$disconnect();

  execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
    env: {
      ...env,
      ADMIN_EMAIL: E2E_ADMIN.email,
      ADMIN_PASSWORD: E2E_ADMIN.password,
      ADMIN_NAME: 'Administrateur E2E',
    },
    stdio: 'inherit',
  });
}

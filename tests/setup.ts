import { config as loadEnv } from 'dotenv';

loadEnv();

/**
 * Les tests d'intégration s'exécutent sur une base dédiée.
 * TEST_DATABASE_URL est obligatoire : jamais la base de développement.
 */
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.TZ = 'Africa/Dakar';
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? 'test-secret-test-secret-test-secret-test-secret';
process.env.EMAIL_PROVIDER = 'preview';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.REPORT_STORAGE_DIR = './storage/test-reports';

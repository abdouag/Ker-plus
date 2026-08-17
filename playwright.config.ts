import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv();

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Base dédiée aux tests de bout en bout (jamais la base de développement). */
const DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

export const E2E_ADMIN = {
  email: 'e2e-admin@kerplus.sn',
  password: 'MotDePasseE2E2026',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Permet d'utiliser un Chromium déjà présent sur la machine (CI, conteneur)
    // plutôt que celui téléchargé par `npx playwright install`.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
      PAYMENT_PROVIDER: 'wave_link',
      WAVE_PAYMENT_URL: 'https://wave.com/pay/kerplus',
      EMAIL_PROVIDER: 'preview',
      RATE_LIMIT_ENABLED: 'false',
      REPORT_STORAGE_DIR: './storage/e2e-reports',
      NODE_ENV: 'production',
    },
  },
});

import { expect, test } from '@playwright/test';

/**
 * Kër Care : découverte publique, protection de l'espace client, création de
 * compte, ajout d'un logement et signalement d'un problème.
 */

test('la page Kër Care présente le service sans promesse trompeuse', async ({ page }) => {
  await page.goto('/ker-care');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Prenez soin de votre maison',
  );
  await expect(page.getByText('Offre indicative').first()).toBeVisible();
  await expect(page.getByText(/pas un service de secours/).first()).toBeAttached();
});

test('l’espace client exige une connexion', async ({ page }) => {
  await page.goto('/ker-care/mon-espace/maisons');
  await page.waitForURL(/\/compte\/connexion\?next=/);
  await page.goto('/ker-care/prestataire');
  await page.waitForURL(/\/compte\/connexion/);
});

test('un client crée son compte, ajoute sa maison et signale un problème', async ({
  page,
}, info) => {
  const email = `e2e-care-${info.project.name}-${Date.now()}@example.com`;
  await page.goto('/compte/inscription');
  await page.locator('input[name="name"]').fill('Aminata Sow');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phone"]').fill('77 765 43 21');
  await page.locator('input[name="password"]').fill('Maison2026');
  await page.locator('input[name="consent"]').check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL(/\/ker-care\/mon-espace/);

  await page.goto('/ker-care/mon-espace/maisons/nouvelle');
  await page.locator('input[name="name"]').fill('Appartement Point E');
  await page.locator('input[name="commune"]').fill('Dakar');
  await page.getByRole('button', { name: 'Ajouter ce logement' }).click();
  await page.waitForURL(/\/maisons\/c[a-z0-9]{20,}$/);

  await page.goto('/ker-care/mon-espace/demandes/nouvelle');
  await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
  await page
    .locator('textarea[name="description"]')
    .fill('Fuite sous l’évier de la cuisine depuis ce matin.');
  await page.locator('input[name="kind"][value="QUICK_REPAIR"]').check();
  await page.getByRole('button', { name: 'Confirmer et envoyer la demande' }).click();
  await page.waitForURL(/\/demandes\/KP-DEP-\d{8}-/);
  await expect(page.getByText('Demande reçue').first()).toBeVisible();

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual((page.viewportSize()?.width ?? 1280) + 1);
});

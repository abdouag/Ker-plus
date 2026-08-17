import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN } from '../playwright.config';

/**
 * Parcours administrateur : connexion, recherche de la commande, confirmation
 * manuelle du paiement, préparation puis livraison du rapport.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/admin\/dashboard/);
}

/** Crée une commande depuis le parcours public et retourne sa référence. */
async function createOrder(page: Page, email: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('cta-report').click();
  await page.locator('input[name="firstName"]').fill('Moussa');
  await page.locator('input[name="lastName"]').fill('Diallo');
  await page.locator('input[name="phone"]').fill('76 555 44 33');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="city"]').fill('Thiès');
  await page.locator('input[name="acceptTerms"]').check();
  await page.locator('input[name="consentData"]').check();
  await page.getByRole('button', { name: /Commander mon rapport/ }).click();
  await page.waitForURL(/\/commande\/KP-CMD-/, { timeout: 30_000 });

  const url = new URL(page.url());
  return url.pathname.split('/').pop() as string;
}

test('l’administration est protégée', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await page.waitForURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

  await page.goto('/admin/commandes');
  await page.waitForURL(/\/admin\/login/);
});

test('des identifiants invalides sont rejetés sans indice', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[name="password"]').fill('MauvaisMotDePasse123');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.getByText('Identifiants invalides.')).toBeVisible();
  expect(page.url()).toContain('/admin/login');
});

test('cycle complet : paiement confirmé puis rapport préparé et livré', async ({ page }) => {
  const email = `moussa.${Date.now()}@example.com`;
  const reference = await createOrder(page, email);

  await login(page);

  // Le tableau de bord reflète l'activité.
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  await expect(page.getByText('En attente de paiement').first()).toBeVisible();

  // Recherche de la commande.
  await page.goto('/admin/commandes');
  await page.getByPlaceholder('Référence, nom, email').fill(reference);
  await page.getByRole('button', { name: 'Filtrer' }).click();
  await page.getByRole('link', { name: reference }).click();

  await expect(page.getByRole('heading', { level: 1 })).toContainText(reference);
  await expect(page.getByText('En attente de paiement').first()).toBeVisible();

  // Confirmation manuelle du paiement.
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('input[name="externalReference"]').first().fill('WAVE-E2E-0001');
  await page.getByRole('button', { name: 'Confirmer le paiement' }).click();
  // Après confirmation, le formulaire disparaît : la commande est payée.
  await expect(page.getByText('Paiement : Payé')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Payée').first()).toBeVisible();

  // Saisie du rapport.
  await page.locator('input[name="itemAmount"]').nth(0).fill('12000000');
  await page.locator('input[name="itemAmount"]').nth(1).fill('9000000');
  await page.locator('textarea[name="summary"]').fill('Projet cohérent, budget maîtrisé.');
  await page.locator('input[name="validatedBy"]').fill('Ing. Kerplus');
  await page.getByRole('button', { name: 'Enregistrer le rapport' }).click();
  await expect(page.getByText('Rapport enregistré.')).toBeVisible({ timeout: 20_000 });

  // Contrôle automatique de la somme des postes.
  await expect(page.getByText(/Total des postes saisis/)).toBeVisible();

  // Génération du PDF puis envoi au client.
  await page.getByRole('button', { name: 'Générer le PDF' }).click();
  await expect(page.getByText(/PDF généré/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Envoyer au client' }).click();
  await expect(page.getByText(/Rapport envoyé/)).toBeVisible({ timeout: 30_000 });

  // La commande est livrée.
  await page.reload();
  await expect(page.getByText('Livrée').first()).toBeVisible();

  // Le client voit désormais son paiement confirmé.
  await page.goto(`/commande/${reference}`);
  await expect(page.getByText('Paiement confirmé')).toBeVisible();
});

test('les paramètres sont modifiables et s’appliquent à l’estimateur', async ({ page }) => {
  await login(page);
  await page.goto('/admin/parametres');

  await expect(page.getByRole('heading', { name: 'Types de projets' })).toBeVisible();

  const priceField = page.locator('#setting-premium_report_price_xof');
  await priceField.fill('60000');
  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(page.getByText(/paramètre\(s\) enregistré\(s\)/)).toBeVisible({ timeout: 20_000 });

  await page.goto('/');
  await expect(page.getByTestId('cta-report')).toContainText('60');

  // Restauration du tarif initial.
  await page.goto('/admin/parametres');
  await page.locator('#setting-premium_report_price_xof').fill('50000');
  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(page.getByText(/paramètre\(s\) enregistré\(s\)/)).toBeVisible({ timeout: 20_000 });
});

test('les exports sont disponibles pour un administrateur', async ({ page }) => {
  await login(page);
  await page.goto('/admin/simulations');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Export CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/kerplus-simulations-\d{4}-\d{2}-\d{2}\.csv/);
});

test('un lien de rapport invalide ne divulgue rien', async ({ page }) => {
  const response = await page.goto('/rapport/jeton-invalide-mais-suffisamment-long-1234567890');
  expect(response?.status()).toBe(404);
  await expect(page.getByText(/Lien de téléchargement invalide/)).toBeVisible();
});

import { expect, test } from '@playwright/test';

/**
 * Parcours public : estimation immédiate, influence réelle de chaque champ,
 * puis commande du rapport et page de confirmation.
 */

test('l’estimation se met à jour instantanément et chaque champ influence le résultat', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Construisez votre maison');

  const total = page.getByTestId('estimation-total');
  await expect(total).toBeVisible();

  // Valeurs initiales : 150 m², Dakar, Standard, maison individuelle.
  const initial = (await total.textContent()) ?? '';
  expect(initial.replace(/\D/g, '')).toBe('33000000');

  // Le type de projet doit réellement changer le montant.
  await page.getByRole('radio', { name: /Villa duplex/ }).check();
  await expect(total).not.toHaveText(initial);
  expect(((await total.textContent()) ?? '').replace(/\D/g, '')).toBe('36300000');

  // La surface : slider et champ numérique restent synchronisés.
  const surfaceInput = page.locator('#surface-number');
  await surfaceInput.fill('200');
  await surfaceInput.blur();
  await expect(page.locator('input[type="range"]')).toHaveValue('200');
  expect(((await total.textContent()) ?? '').replace(/\D/g, '')).toBe('48400000');

  // La ville.
  await page.getByLabel('3. Ville ou zone du projet').selectOption({ label: 'Tambacounda' });
  expect(((await total.textContent()) ?? '').replace(/\D/g, '')).toBe('39600000');

  // Le niveau de finition.
  await page.getByRole('radio', { name: /Haut standing/ }).check();
  expect(((await total.textContent()) ?? '').replace(/\D/g, '')).toBe('55440000');

  // La fourchette suit à ±10 %.
  const range = (await page.getByTestId('estimation-range').textContent()) ?? '';
  expect(range.replace(/[^\d]/g, '')).toBe('4989600060984000');

  // Le récapitulatif reprend les paramètres et une référence est enregistrée.
  const summary = page.getByTestId('estimation-summary');
  await expect(summary).toContainText('Tambacounda');
  await expect(summary).toContainText('Haut standing');
  await expect(summary).toContainText('200 m²');
  await expect(summary).toContainText(/KP-EST-\d{8}-/, { timeout: 15_000 });
});

test('les bornes de surface sont respectées', async ({ page }) => {
  await page.goto('/');
  const surfaceInput = page.locator('#surface-number');

  await surfaceInput.fill('10');
  await surfaceInput.blur();
  await expect(surfaceInput).toHaveValue('80');

  await surfaceInput.fill('9999');
  await surfaceInput.blur();
  await expect(surfaceInput).toHaveValue('500');
});

test('« Faire une nouvelle estimation » réinitialise le formulaire sans recharger', async ({
  page,
}) => {
  await page.goto('/');
  const surfaceInput = page.locator('#surface-number');

  await surfaceInput.fill('300');
  await surfaceInput.blur();
  await expect(surfaceInput).toHaveValue('300');

  await page.getByTestId('new-estimation').click();
  await expect(surfaceInput).toHaveValue('150');
});

test('l’avertissement et les exclusions sont affichés', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/ne constitue ni un devis contractuel/)).toBeVisible();
  await expect(
    page.getByText('Le prix du terrain n’est jamais inclus dans le calcul.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Postes exclus de l’estimation' })).toBeVisible();
});

test('parcours complet jusqu’à la confirmation de commande', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('radio', { name: /Villa duplex/ }).check();
  await page.getByTestId('cta-report').click();

  // Étape services : sélection multiple, reflétée dans le résumé du formulaire.
  await page.locator('input[name="requestedServices"][value="architectural_design"]').check();
  await page.locator('input[name="requestedServices"][value="construction_monitoring"]').check();
  await expect(page.getByText('Services sélectionnés pour votre projet')).toBeVisible();

  await page.locator('input[name="firstName"]').fill('Awa');
  await page.locator('input[name="lastName"]').fill('Ndiaye');
  await page.locator('input[name="phone"]').fill('77 123 45 67');
  await page.locator('input[name="email"]').fill('awa.e2e@example.com');
  await page.locator('input[name="city"]').fill('Dakar');
  await page.locator('input[name="acceptTerms"]').check();
  await page.locator('input[name="consentData"]').check();

  await page.getByRole('button', { name: /Commander mon rapport/ }).click();

  await page.waitForURL(/\/commande\/KP-CMD-/, { timeout: 30_000 });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Commande n° KP-CMD-');
  // Aucun message de succès de paiement ne doit apparaître.
  await expect(page.getByText('Paiement en attente de vérification')).toBeVisible();
  await expect(page.getByText('Paiement confirmé')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Payer .* avec Wave/ })).toBeVisible();
  await expect(page.getByText('awa.e2e@example.com')).toBeVisible();
  await expect(page.getByText('Villa duplex')).toBeVisible();

  // Les services demandés apparaissent sur la confirmation, avec leur statut.
  await expect(page.getByRole('heading', { name: 'Services de mon projet' })).toBeVisible();
  await expect(page.getByText('Conception architecturale')).toBeVisible();
  await expect(page.getByText('Suivi de chantier')).toBeVisible();
  await expect(page.getByText('Non démarré').first()).toBeVisible();
});

test('la sélection de services survit au retour en arrière', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('cta-report').click();
  await page.locator('input[name="requestedServices"][value="3d_visualization"]').check();

  // Retour à l'estimation : le formulaire est replié…
  await page.getByRole('button', { name: 'Modifier mon estimation' }).first().click();
  await page.getByTestId('cta-report').click();
  // …et la sélection est toujours là.
  await expect(
    page.locator('input[name="requestedServices"][value="3d_visualization"]'),
  ).toBeChecked();

  // « Conseillez-moi » est exclusif.
  await page.locator('input[name="requestedServices"][value="needs_guidance"]').check();
  await expect(
    page.locator('input[name="requestedServices"][value="3d_visualization"]'),
  ).not.toBeChecked();
});

test('la page /services présente les six services', async ({ page }) => {
  await page.goto('/services');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Tous les services nécessaires',
  );
  for (const service of [
    'Conception architecturale',
    'Étude béton armé',
    'Études des lots techniques',
    'Visualisation 3D',
    'Assistance technique',
    'Suivi de chantier',
  ]) {
    await expect(page.getByRole('heading', { name: service, exact: true })).toBeVisible();
  }
  // Aucun prix sur la page services.
  const body = (await page.locator('main').innerText()) ?? '';
  expect(body).not.toMatch(/FCFA|\/m²/);
});

test('« Ajouter à mon projet » présélectionne le service dans le formulaire', async ({ page }) => {
  await page.goto('/?service=etude-beton-arme#estimateur');
  await page.getByTestId('cta-report').click();
  await expect(
    page.locator('input[name="requestedServices"][value="structural_engineering"]'),
  ).toBeChecked();
});

test('la validation du formulaire signale les champs manquants', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('cta-report').click();

  await page.locator('input[name="firstName"]').fill('A');
  await page.getByRole('button', { name: /Commander mon rapport/ }).click();

  await expect(page.getByText('Certaines informations doivent être corrigées.')).toBeVisible();
  await expect(page.getByText('Vous devez accepter les conditions générales.')).toBeVisible();
});

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { CheckboxField, SelectField, TextField } from '@/components/ui/Field';
import { requireClientPage } from '@/lib/auth/account-guard';
import { CareError } from '@/lib/care/errors';
import { getOwnedProperty } from '@/lib/care/services/properties';
import { listEstimatorCities } from '@/lib/care/services/client-queries';
import { getCompanyContact } from '@/lib/settings';
import { SURFACE_MAX, SURFACE_MIN } from '@/lib/estimation/constants';

export const metadata: Metadata = { title: 'Projet de rénovation' };
export const dynamic = 'force-dynamic';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Passerelle Kër Care → Kerplus construction (point d'extension).
 *
 * Aucun projet n'est créé automatiquement : après consentement explicite,
 * le client est redirigé vers l'estimateur prérempli (surface, ville).
 * Les données transmises se limitent à ces deux paramètres d'URL.
 */
export default async function RenovationBridgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await requireClientPage(`/ker-care/mon-espace/maisons/${id}/renovation`);
  let property;
  try {
    property = await getOwnedProperty(account.id, id);
  } catch (error) {
    if (error instanceof CareError) notFound();
    throw error;
  }
  const [cities, contact] = await Promise.all([listEstimatorCities(), getCompanyContact()]);
  const commune = normalize(property.commune);
  const matched =
    cities.find((city) => normalize(city.name) === commune) ??
    cities.find((city) => commune.includes(normalize(city.name)));
  const surface =
    property.surface && property.surface >= SURFACE_MIN && property.surface <= SURFACE_MAX
      ? property.surface
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-sm">
        <Link
          href={`/ker-care/mon-espace/maisons/${property.id}`}
          className="font-semibold text-forest-600 underline"
        >
          ← Retour au carnet
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-extrabold text-forest-700">Créer un projet de rénovation</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {property.name} · {property.commune}
        </p>
      </div>

      <Alert tone="info">
        Pour une rénovation lourde, une extension ou une surélévation, Kerplus vous accompagne avec
        son estimateur et son rapport technique détaillé. L’estimateur est conçu pour la
        construction : pour une rénovation, son résultat donne un ordre de grandeur. Rien n’est créé
        ni commandé automatiquement.
      </Alert>

      <Card>
        <CardBody>
          <form method="get" action="/#estimateur" className="space-y-4">
            <p className="text-sm text-ink-soft">
              Les informations ci-dessous seront transmises à l’estimateur pour le préremplir. Vous
              pourrez les modifier librement avant tout calcul.
            </p>
            <TextField
              label="Surface concernée (m²)"
              name="surface"
              type="number"
              inputMode="numeric"
              min={SURFACE_MIN}
              max={SURFACE_MAX}
              defaultValue={surface ?? ''}
              hint={surface ? 'Reprise de la fiche du logement.' : 'Facultatif.'}
            />
            <SelectField
              label="Ville / zone de calcul"
              name="ville"
              defaultValue={matched?.name ?? ''}
            >
              <option value="">Je choisirai dans l’estimateur</option>
              {cities.map((city) => (
                <option key={city.id} value={city.name}>
                  {city.name}
                </option>
              ))}
            </SelectField>
            <CheckboxField
              required
              label="J’accepte que la surface et la ville de ce logement soient utilisées pour préremplir l’estimateur Kerplus."
            />
            <button
              type="submit"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ember-400 px-5 font-bold text-forest-800 shadow-card hover:bg-ember-300 sm:w-auto"
            >
              Continuer vers l’estimateur
            </button>
          </form>
        </CardBody>
      </Card>

      <p className="text-sm text-ink-soft">
        Vous préférez en parler d’abord ? Contactez Kerplus
        {contact.phone ? ` au ${contact.phone}` : ''}
        {contact.email ? ` ou à ${contact.email}` : ''}.
      </p>
    </div>
  );
}

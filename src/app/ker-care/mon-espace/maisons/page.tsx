import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { IconHome, IconMapPin } from '@/components/ui/icons';
import { requireClientPage } from '@/lib/auth/account-guard';
import { listProperties } from '@/lib/care/services/properties';
import { PROPERTY_TYPE_LABELS } from '@/lib/care/constants';

export const metadata: Metadata = { title: 'Mes maisons' };
export const dynamic = 'force-dynamic';

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ archives?: string }>;
}) {
  const account = await requireClientPage('/ker-care/mon-espace/maisons');
  const { archives } = await searchParams;
  const showArchived = archives === '1';
  const properties = await listProperties(account.id, showArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-700">Mes maisons</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Chaque logement possède son carnet : équipements, documents, entretiens et historique.
          </p>
        </div>
        <LinkButton href="/ker-care/mon-espace/maisons/nouvelle">Ajouter un logement</LinkButton>
      </div>

      <p className="text-sm">
        <Link
          href={
            showArchived
              ? '/ker-care/mon-espace/maisons'
              : '/ker-care/mon-espace/maisons?archives=1'
          }
          className="font-semibold text-forest-600 underline"
        >
          {showArchived
            ? 'Masquer les logements archivés'
            : 'Afficher aussi les logements archivés'}
        </Link>
      </p>

      {properties.length === 0 ? (
        <EmptyState
          title="Aucun logement pour le moment"
          description="Ajoutez votre maison pour commencer son carnet numérique."
          action={
            <LinkButton href="/ker-care/mon-espace/maisons/nouvelle">Ajouter ma maison</LinkButton>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/ker-care/mon-espace/maisons/${property.id}`}
                className="flex h-full gap-4 rounded-2xl border border-sand-200 bg-white p-5 shadow-card transition-colors hover:border-forest-300"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                  <IconHome width={22} height={22} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-forest-700">{property.name}</span>
                    {property.archivedAt ? <Badge>Archivé</Badge> : null}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
                    <IconMapPin className="h-4 w-4 shrink-0" />
                    {PROPERTY_TYPE_LABELS[property.type]} · {property.commune}
                    {property.quartier ? `, ${property.quartier}` : ''}
                  </span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {property._count.equipments} équipement(s) · {property._count.requests}{' '}
                    demande(s)
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

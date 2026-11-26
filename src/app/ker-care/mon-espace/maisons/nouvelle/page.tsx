import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { PropertyForm } from '@/components/care/client/PropertyForm';
import { requireClientPage } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';

export const metadata: Metadata = { title: 'Ajouter un logement' };
export const dynamic = 'force-dynamic';

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  await requireClientPage('/ker-care/mon-espace/maisons/nouvelle');
  const { retour } = await searchParams;
  const csrfToken = await getCsrfToken();
  const fromRequest = retour === 'demande';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-sm">
        <Link
          href={
            fromRequest ? '/ker-care/mon-espace/demandes/nouvelle' : '/ker-care/mon-espace/maisons'
          }
          className="font-semibold text-forest-600 underline"
        >
          ← Retour
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-extrabold text-forest-700">Ajouter un logement</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {fromRequest
            ? 'Quelques informations suffisent ; vous reviendrez ensuite à votre demande d’intervention.'
            : 'Seuls le nom, le type et la commune sont nécessaires. Vous pourrez compléter plus tard.'}
        </p>
      </div>
      <Card>
        <CardBody>
          <PropertyForm csrfToken={csrfToken} returnTo={fromRequest ? 'demande' : undefined} />
        </CardBody>
      </Card>
    </div>
  );
}

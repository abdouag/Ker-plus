import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { AccountLoginForm } from '@/components/care/auth/LoginForm';
import { getCurrentAccount } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { getCompanyContact } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Connexion — Kër Care',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = '' } = await searchParams;
  const account = await getCurrentAccount();
  if (account) {
    redirect(account.role === 'PROVIDER' ? '/ker-care/prestataire' : '/ker-care/mon-espace');
  }
  const [csrfToken, contact] = await Promise.all([getCsrfToken(), getCompanyContact()]);
  const safeNext = next.startsWith('/ker-care/') ? next : '';

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="bg-sand-100">
        <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">Kër Care</p>
          <h1 className="mt-2 text-2xl font-extrabold text-forest-700 sm:text-3xl">
            Connexion à votre espace
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Retrouvez vos logements, votre carnet d’entretien et le suivi de vos interventions.
          </p>

          <Card className="mt-6">
            <CardBody>
              <AccountLoginForm csrfToken={csrfToken} next={safeNext} />
            </CardBody>
          </Card>

          <p className="mt-5 text-center text-sm text-ink-soft">
            Pas encore de compte ?{' '}
            <Link
              href={`/compte/inscription${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`}
              className="font-semibold text-forest-600 underline"
            >
              Créer un compte
            </Link>
          </p>

          <Alert tone="neutral" className="mt-6">
            <p>
              <span className="font-semibold">Mot de passe oublié ?</span> Contactez Kerplus
              {contact.phone ? (
                <>
                  {' '}
                  au{' '}
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, '')}`}
                    className="font-semibold underline"
                  >
                    {contact.phone}
                  </a>
                </>
              ) : null}
              {contact.email ? (
                <>
                  {' '}
                  ou par email à{' '}
                  <a href={`mailto:${contact.email}`} className="font-semibold underline">
                    {contact.email}
                  </a>
                </>
              ) : null}
              . Un mot de passe temporaire vous sera communiqué après vérification de votre
              identité.
            </p>
            <p className="mt-2">
              <span className="font-semibold">Prestataires :</span> votre compte est créé par
              Kerplus après vérification. Utilisez les identifiants qui vous ont été transmis.
            </p>
          </Alert>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { AccountSignupForm } from '@/components/care/auth/SignupForm';
import { getCurrentAccount } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { getSettingBool, SETTING_KEYS } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Créer un compte — Kër Care',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = '' } = await searchParams;
  const account = await getCurrentAccount();
  if (account) {
    redirect(account.role === 'PROVIDER' ? '/ker-care/prestataire' : '/ker-care/mon-espace');
  }
  const [csrfToken, signupOpen] = await Promise.all([
    getCsrfToken(),
    getSettingBool(SETTING_KEYS.CARE_SIGNUP_ENABLED, true),
  ]);
  const safeNext = next.startsWith('/ker-care/') ? next : '';

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="bg-sand-100">
        <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">Kër Care</p>
          <h1 className="mt-2 text-2xl font-extrabold text-forest-700 sm:text-3xl">
            Créer votre compte
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Gratuit et sans engagement : ajoutez votre maison, tenez son carnet d’entretien et
            demandez une intervention en quelques minutes.
          </p>

          <Card className="mt-6">
            <CardBody>
              {signupOpen ? (
                <AccountSignupForm csrfToken={csrfToken} next={safeNext} />
              ) : (
                <Alert tone="warning">
                  La création de compte est momentanément fermée. Contactez Kerplus pour toute
                  demande.
                </Alert>
              )}
            </CardBody>
          </Card>

          <p className="mt-5 text-center text-sm text-ink-soft">
            Déjà inscrit ?{' '}
            <Link
              href={`/compte/connexion${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`}
              className="font-semibold text-forest-600 underline"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

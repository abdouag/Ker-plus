import type { Metadata } from 'next';
import Link from 'next/link';
import { requireProviderPage } from '@/lib/auth/account-guard';
import { accountLogoutAction } from '@/app/compte/actions';
import { ProviderNav } from '@/components/care/provider/ProviderNav';
import { VerificationBadge } from '@/components/care/StatusBadge';
import { Alert } from '@/components/ui/Feedback';

export const metadata: Metadata = {
  title: { default: 'Espace prestataire', template: '%s | Kër Care prestataire' },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const account = await requireProviderPage('/ker-care/prestataire');
  const status = account.providerProfile.verificationStatus;

  return (
    <div className="min-h-screen bg-sand-100">
      <header className="bg-forest-600 text-white">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/ker-care/prestataire" className="text-lg font-extrabold">
            Kër Care<span className="text-ember-400">+</span>
            <span className="ml-2 text-xs font-medium text-forest-100">Prestataire</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-forest-100 sm:inline">{account.name}</span>
            <VerificationBadge status={status} />
            <form action={accountLogoutAction}>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg border border-forest-400 px-3 text-sm font-semibold text-white hover:bg-forest-700"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <ProviderNav />
      </header>

      <main id="contenu" className="mx-auto max-w-content space-y-5 px-4 py-6 sm:px-6">
        {status !== 'VERIFIED' ? (
          <Alert tone="warning" title="Profil non vérifié">
            {status === 'PENDING'
              ? 'Kerplus vérifie votre identité, vos compétences et vos références. Les missions ne vous sont affectées qu’après cette vérification.'
              : 'Votre profil n’est pas actif pour le moment : aucune nouvelle mission ne peut vous être affectée. Contactez Kerplus pour plus d’informations.'}
          </Alert>
        ) : null}
        {children}
      </main>
    </div>
  );
}

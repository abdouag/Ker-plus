import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { LinkButton } from '@/components/ui/Button';
import { ClientNav } from '@/components/care/client/ClientNav';
import { requireClientPage } from '@/lib/auth/account-guard';
import { accountLogoutAction } from '@/app/compte/actions';

export const metadata: Metadata = {
  title: { default: 'Mon espace Kër Care', template: '%s | Kër Care' },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ClientSpaceLayout({ children }: { children: React.ReactNode }) {
  const account = await requireClientPage('/ker-care/mon-espace');

  return (
    <>
      <SiteHeader />
      <div className="border-b border-sand-200 bg-sand-50">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ember-500">
              Kër Care · Mon espace
            </p>
            <p className="truncate text-sm font-bold text-forest-700">{account.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <LinkButton href="/ker-care/mon-espace/demandes/nouvelle" size="sm">
              Signaler un problème
            </LinkButton>
            <form action={accountLogoutAction}>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl border border-sand-300 px-3 text-sm font-semibold text-ink-soft hover:bg-white"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <ClientNav />
      </div>
      <main id="contenu" className="min-h-[60vh] bg-sand-100">
        <div className="mx-auto max-w-content px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

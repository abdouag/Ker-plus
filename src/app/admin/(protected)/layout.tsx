import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/guard';
import { logoutAction } from '@/app/admin/actions/auth';
import { AdminNav } from '@/components/admin/AdminNav';

export const metadata: Metadata = {
  title: { default: 'Administration', template: '%s | Administration Kerplus' },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-sand-100">
      <header className="border-b border-forest-700 bg-forest-600 text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin/dashboard" className="text-lg font-extrabold">
            Kerplus<span className="text-ember-400">.sn</span>
            <span className="ml-2 text-xs font-medium text-forest-100">Administration</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-forest-100 sm:inline">
              {admin.name} · {admin.role}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-forest-400 px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest-700"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>

      <main id="contenu" className="mx-auto max-w-[1400px] px-4 py-6">
        {children}
      </main>
    </div>
  );
}

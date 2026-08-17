import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { LoginForm } from '@/components/admin/LoginForm';
import { getCsrfToken } from '@/lib/security/csrf';

export const metadata: Metadata = {
  title: 'Connexion administration',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const csrfToken = await getCsrfToken();

  return (
    <main
      id="contenu"
      className="flex min-h-screen items-center justify-center bg-forest-700 px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-2xl font-extrabold text-white">
            Kerplus<span className="text-ember-400">.sn</span>
          </p>
          <p className="mt-1 text-sm text-forest-100">Espace d’administration</p>
        </div>

        <Card>
          <CardBody>
            <h1 className="mb-5 text-lg font-bold">Connexion</h1>
            <LoginForm csrfToken={csrfToken} next={next ?? '/admin/dashboard'} />
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-sm text-forest-100">
          <Link href="/" className="underline">
            Retour au site public
          </Link>
        </p>
      </div>
    </main>
  );
}

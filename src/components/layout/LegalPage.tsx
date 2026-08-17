import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {updatedAt ? (
          <p className="mt-2 text-sm text-ink-muted">Dernière mise à jour : {updatedAt}</p>
        ) : null}
        <div className="kp-prose mt-8">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * Encadré signalant une information à compléter par Kerplus.
 * Aucune coordonnée juridique n'est inventée dans ce dépôt.
 */
export function ToComplete({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-ember-300 bg-ember-50 px-4 py-3 text-sm text-ember-900">
      {children}
    </p>
  );
}

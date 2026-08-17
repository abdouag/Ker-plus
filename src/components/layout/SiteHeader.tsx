import Link from 'next/link';
import { LinkButton } from '@/components/ui/Button';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="Kerplus.sn — accueil">
          {/* Aucun logo officiel n'a été fourni : identité typographique uniquement. */}
          <span className="text-xl font-extrabold tracking-tight text-forest-600">Kerplus</span>
          <span className="text-xl font-extrabold text-ember-400">.sn</span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-6 md:flex">
          <Link
            href="/#estimateur"
            className="text-sm font-semibold text-ink-soft hover:text-forest-600"
          >
            Estimateur
          </Link>
          <Link
            href="/#rapport"
            className="text-sm font-semibold text-ink-soft hover:text-forest-600"
          >
            Rapport détaillé
          </Link>
          <Link
            href="/#methode"
            className="text-sm font-semibold text-ink-soft hover:text-forest-600"
          >
            Méthode
          </Link>
        </nav>

        <LinkButton href="/#estimateur" size="sm" className="shrink-0">
          Estimer mon projet
        </LinkButton>
      </div>
    </header>
  );
}

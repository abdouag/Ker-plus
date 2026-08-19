'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/Button';
import { IconClose, IconMenu } from '@/components/ui/icons';

const NAV_LINKS = [
  { href: '/#estimateur', label: 'Estimateur' },
  { href: '/services', label: 'Services' },
  { href: '/#realisations', label: 'Réalisations' },
  { href: '/#rapport', label: 'Rapport détaillé' },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="Kerplus.sn — accueil">
          {/* Aucun logo officiel n'a été fourni : identité typographique uniquement. */}
          <span className="text-xl font-extrabold tracking-tight text-forest-600">Kerplus</span>
          <span className="text-xl font-extrabold text-ember-400">.sn</span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-ink-soft transition-colors hover:text-forest-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LinkButton href="/#estimateur" size="sm" className="shrink-0">
            Estimer mon projet
          </LinkButton>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sand-200 text-forest-700 hover:bg-sand-50 md:hidden"
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="menu-mobile"
          aria-label="Navigation mobile"
          className="border-t border-sand-200 bg-white px-4 py-2 md:hidden"
        >
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-2 py-3 text-base font-semibold text-ink-soft hover:bg-sand-50 hover:text-forest-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

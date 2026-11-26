'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/ker-care/mon-espace', label: 'Vue d’ensemble', exact: true },
  { href: '/ker-care/mon-espace/maisons', label: 'Mes maisons' },
  { href: '/ker-care/mon-espace/entretiens', label: 'Entretiens' },
  { href: '/ker-care/mon-espace/demandes', label: 'Mes interventions' },
  { href: '/ker-care/mon-espace/offres', label: 'Offres' },
];

/** Navigation de l'espace client — défilement horizontal sur mobile. */
export function ClientNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Espace Kër Care" className="border-t border-sand-200 bg-white">
      <ul className="mx-auto flex max-w-content gap-1 overflow-x-auto px-2 py-1.5 sm:px-4">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-forest-600 text-white'
                    : 'text-ink-soft hover:bg-sand-50 hover:text-forest-600',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

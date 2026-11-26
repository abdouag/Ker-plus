'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/ker-care/prestataire', label: 'Tableau de bord', exact: true },
  { href: '/ker-care/prestataire/profil', label: 'Profil', exact: false },
];

export function ProviderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation prestataire" className="border-t border-forest-500 bg-forest-700">
      <ul className="mx-auto flex max-w-content gap-1 overflow-x-auto px-2 py-1.5 sm:px-4">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href || pathname.startsWith(`${link.href}/missions`)
            : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors',
                  active ? 'bg-ember-400 text-forest-800' : 'text-forest-100 hover:bg-forest-600',
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

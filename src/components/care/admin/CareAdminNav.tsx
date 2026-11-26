'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/admin/ker-care', label: 'Tableau de bord', exact: true },
  { href: '/admin/ker-care/demandes', label: 'Demandes', exact: false },
  { href: '/admin/ker-care/prestataires', label: 'Prestataires', exact: false },
  { href: '/admin/ker-care/catalogue', label: 'Catalogue', exact: false },
];

/** Sous-navigation de la section Kër Care de l'administration. */
export function CareAdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation Kër Care" className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-[40px] items-center rounded-full border px-4 text-sm font-semibold transition-colors',
              active
                ? 'border-forest-600 bg-forest-600 text-white'
                : 'border-sand-300 bg-white text-ink-soft hover:border-forest-300 hover:text-forest-600',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/admin/dashboard', label: 'Tableau de bord' },
  { href: '/admin/simulations', label: 'Simulations' },
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/commandes', label: 'Commandes' },
  { href: '/admin/paiements', label: 'Paiements' },
  { href: '/admin/rapports', label: 'Rapports' },
  { href: '/admin/parametres', label: 'Paramètres' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation administration"
      className="border-t border-forest-500 bg-forest-700"
    >
      <ul className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-2 py-1.5">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
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

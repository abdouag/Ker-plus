import type { ReactNode } from 'react';
import { Card, CardBody } from '@/components/ui/Card';

/**
 * Barre de filtres en GET : fonctionne sans JavaScript, les filtres restent
 * partageables par URL et l'export réutilise exactement les mêmes paramètres.
 */
export function FilterBar({
  action,
  children,
  exportHref,
}: {
  action: string;
  children: ReactNode;
  exportHref?: string;
}) {
  return (
    <Card>
      <CardBody className="py-4">
        <form method="get" action={action} className="flex flex-wrap items-end gap-3">
          {children}
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-[44px] rounded-xl bg-forest-600 px-4 font-semibold text-white hover:bg-forest-500"
            >
              Filtrer
            </button>
            <a
              href={action}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-sand-300 px-4 font-semibold text-ink-soft hover:bg-sand-50"
            >
              Réinitialiser
            </a>
          </div>
          {exportHref ? (
            <div className="ml-auto flex gap-2">
              <a
                href={`${exportHref}&format=csv`}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-forest-200 px-4 text-sm font-semibold text-forest-700 hover:bg-sand-50"
              >
                Export CSV
              </a>
              <a
                href={`${exportHref}&format=xlsx`}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-forest-200 px-4 text-sm font-semibold text-forest-700 hover:bg-sand-50"
              >
                Export Excel
              </a>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ''}`}>
      <span className="font-semibold text-forest-700">{label}</span>
      {children}
    </label>
  );
}

export const FILTER_INPUT_CLASS =
  'min-h-[44px] rounded-xl border border-sand-300 bg-white px-3 text-base text-ink focus:border-forest-500';

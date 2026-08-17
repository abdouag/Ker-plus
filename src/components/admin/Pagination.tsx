import Link from 'next/link';

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) {
    return (
      <p className="px-4 py-3 text-sm text-ink-muted">
        {total} résultat{total > 1 ? 's' : ''}
      </p>
    );
  }

  const buildHref = (target: number) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    search.set('page', String(target));
    return `${basePath}?${search.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <p className="text-ink-muted">
        Page {page} sur {pageCount} — {total} résultat{total > 1 ? 's' : ''}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            className="rounded-lg border border-sand-300 px-3 py-2 font-semibold hover:bg-sand-50"
          >
            Précédent
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            href={buildHref(page + 1)}
            className="rounded-lg border border-sand-300 px-3 py-2 font-semibold hover:bg-sand-50"
          >
            Suivant
          </Link>
        ) : null}
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import type { RequestKind, RequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import {
  ADMIN_PAGE_SIZE,
  listRequestsForAdmin,
  STATUS_GROUPS,
  type StatusGroup,
} from '@/lib/care/services/admin';
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from '@/lib/care/constants';
import { formatDateTime } from '@/lib/format';
import { FILTER_INPUT_CLASS, FilterBar, FilterField } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';

export const metadata: Metadata = { title: 'Demandes Kër Care' };
export const dynamic = 'force-dynamic';

interface Params {
  statut?: string;
  urgence?: string;
  categorie?: string;
  commune?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: string;
}

function parseDay(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function CareRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireAdmin('/admin/ker-care/demandes');
  const params = await searchParams;
  const status =
    params.statut && params.statut in REQUEST_STATUS_LABELS
      ? (params.statut as RequestStatus)
      : undefined;
  const group =
    params.statut && params.statut in STATUS_GROUPS ? (params.statut as StatusGroup) : undefined;
  const kind =
    params.urgence && params.urgence in REQUEST_KIND_LABELS
      ? (params.urgence as RequestKind)
      : undefined;

  const [result, categories] = await Promise.all([
    listRequestsForAdmin({
      status,
      group,
      kind,
      categoryId: params.categorie || undefined,
      commune: params.commune?.trim().slice(0, 80) || undefined,
      q: params.q?.trim().slice(0, 80) || undefined,
      from: parseDay(params.from),
      to: parseDay(params.to, true),
      page: Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1),
    }),
    prisma.careCategory.findMany({
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Demandes d’intervention</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Filtrer, affecter et suivre les demandes Kër Care.
        </p>
      </div>

      <FilterBar action="/admin/ker-care/demandes">
        <FilterField label="Recherche">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Référence, nom, téléphone"
            className={`${FILTER_INPUT_CLASS} w-56`}
          />
        </FilterField>
        <FilterField label="Statut">
          <select name="statut" defaultValue={status ?? group ?? ''} className={FILTER_INPUT_CLASS}>
            <option value="">Tous</option>
            {Object.entries(STATUS_GROUPS).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Urgence">
          <select name="urgence" defaultValue={kind ?? ''} className={FILTER_INPUT_CLASS}>
            <option value="">Toutes</option>
            {Object.entries(REQUEST_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Catégorie">
          <select
            name="categorie"
            defaultValue={params.categorie ?? ''}
            className={FILTER_INPUT_CLASS}
          >
            <option value="">Toutes</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Commune">
          <input
            type="text"
            name="commune"
            defaultValue={params.commune ?? ''}
            className={`${FILTER_INPUT_CLASS} w-40`}
          />
        </FilterField>
        <FilterField label="Du">
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            className={FILTER_INPUT_CLASS}
          />
        </FilterField>
        <FilterField label="Au">
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            className={FILTER_INPUT_CLASS}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="p-0 sm:p-0">
          {result.items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Aucune demande"
                description="Aucune demande ne correspond à ces critères."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <caption className="sr-only">Demandes d’intervention Kër Care</caption>
                <thead className="bg-sand-50 text-left text-xs uppercase text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Référence
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Client
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Catégorie
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Localisation
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Urgence
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Statut
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Prestataire
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Reçue le
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((request) => {
                    const assignment = request.assignments[0];
                    return (
                      <tr key={request.id} className="border-t border-sand-200">
                        <td className="px-4 py-2.5 font-semibold">
                          <Link
                            href={`/admin/ker-care/demandes/${request.id}`}
                            className="text-forest-600 underline"
                          >
                            {request.reference}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          {request.requester.name}
                          <span className="block text-xs text-ink-muted">
                            {request.requester.phone}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{request.category.name}</td>
                        <td className="px-4 py-2.5">
                          {request.property.commune}
                          {request.property.quartier ? (
                            <span className="block text-xs text-ink-muted">
                              {request.property.quartier}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            tone={
                              request.kind === 'EMERGENCY'
                                ? 'danger'
                                : request.kind === 'QUICK_REPAIR'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {REQUEST_KIND_LABELS[request.kind]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <RequestStatusBadge status={request.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          {assignment ? (
                            <>
                              {assignment.provider.businessName || assignment.provider.account.name}
                              <span className="block text-xs text-ink-muted">
                                {assignment.status === 'PENDING'
                                  ? 'En attente de réponse'
                                  : 'Acceptée'}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted">
                          {formatDateTime(request.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={result.page}
            pageSize={ADMIN_PAGE_SIZE}
            total={result.total}
            basePath="/admin/ker-care/demandes"
            params={params as Record<string, string | undefined>}
          />
        </CardBody>
      </Card>
    </div>
  );
}

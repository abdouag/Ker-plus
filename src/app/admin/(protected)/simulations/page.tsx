import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { FILTER_INPUT_CLASS, FilterBar, FilterField } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { formatDateTime, formatSurface, formatXOF } from '@/lib/format';
import {
  buildQueryString,
  PAGE_SIZE,
  parsePage,
  simulationWhere,
  type ListParams,
} from '@/lib/admin/queries';
import { fromCoefficientInt } from '@/lib/estimation/constants';
import { formatDecimal } from '@/lib/format';

export const metadata: Metadata = { title: 'Simulations' };
export const dynamic = 'force-dynamic';

export default async function AdminSimulationsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireAdmin('/admin/simulations');
  const params = await searchParams;
  const page = parsePage(params.page);
  const where = simulationWhere(params);

  const [cities, finishes, total, simulations] = await Promise.all([
    prisma.cityZone.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.finishLevel.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.simulation.count({ where }),
    prisma.simulation.findMany({
      where,
      include: { customer: true, orders: { select: { id: true, reference: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const exportHref = `/api/admin/export/simulations?${buildQueryString({
    q: params.q,
    from: params.from,
    to: params.to,
    ville: params.ville,
    finition: params.finition,
  })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Simulations</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Chaque simulation conserve les prix et coefficients en vigueur au moment du calcul.
        </p>
      </div>

      <FilterBar action="/admin/simulations" exportHref={exportHref}>
        <FilterField label="Recherche">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Référence, nom, email, téléphone"
            className={`${FILTER_INPUT_CLASS} w-64`}
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
        <FilterField label="Ville">
          <select name="ville" defaultValue={params.ville ?? ''} className={FILTER_INPUT_CLASS}>
            <option value="">Toutes</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Finition">
          <select
            name="finition"
            defaultValue={params.finition ?? ''}
            className={FILTER_INPUT_CLASS}
          >
            <option value="">Toutes</option>
            {finishes.map((finish) => (
              <option key={finish.id} value={finish.id}>
                {finish.name}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="p-0 sm:p-0">
          {simulations.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Aucune simulation"
                description="Aucune simulation ne correspond à ces critères."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-sand-50 text-left text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Référence</th>
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="px-4 py-2 font-semibold">Projet</th>
                    <th className="px-4 py-2 font-semibold">Surface</th>
                    <th className="px-4 py-2 font-semibold">Ville</th>
                    <th className="px-4 py-2 font-semibold">Finition</th>
                    <th className="px-4 py-2 font-semibold">Prix m²</th>
                    <th className="px-4 py-2 font-semibold">Estimation</th>
                    <th className="px-4 py-2 font-semibold">Client</th>
                    <th className="px-4 py-2 font-semibold">Commande</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((simulation) => (
                    <tr key={simulation.id} className="border-t border-sand-200 align-top">
                      <td className="px-4 py-2.5 font-semibold">{simulation.reference}</td>
                      <td className="px-4 py-2.5 text-ink-muted">
                        {formatDateTime(simulation.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {simulation.projectTypeNameSnapshot}
                        <span className="block text-xs text-ink-muted">
                          ×
                          {formatDecimal(fromCoefficientInt(simulation.projectCoefficientSnapshot))}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{formatSurface(simulation.surface)}</td>
                      <td className="px-4 py-2.5">
                        {simulation.cityNameSnapshot}
                        <span className="block text-xs text-ink-muted">
                          ×{formatDecimal(fromCoefficientInt(simulation.cityCoefficientSnapshot))}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{simulation.finishNameSnapshot}</td>
                      <td className="px-4 py-2.5">
                        {formatXOF(simulation.pricePerSquareMeterSnapshot)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold">
                        {formatXOF(simulation.estimatedTotal)}
                        <span className="block text-xs font-normal text-ink-muted">
                          {formatXOF(simulation.estimatedMinimum, { withCurrency: false })} –{' '}
                          {formatXOF(simulation.estimatedMaximum, { withCurrency: false })}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {simulation.customer ? (
                          <Link
                            href={`/admin/clients?q=${encodeURIComponent(simulation.customer.email)}`}
                            className="text-forest-600 underline"
                          >
                            {simulation.customer.firstName} {simulation.customer.lastName}
                          </Link>
                        ) : (
                          <span className="text-ink-muted">Anonyme</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {simulation.orders.length > 0 ? (
                          <Link
                            href={`/admin/commandes/${simulation.orders[0].id}`}
                            className="text-forest-600 underline"
                          >
                            {simulation.orders[0].reference}
                          </Link>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/admin/simulations"
            params={params as Record<string, string | undefined>}
          />
        </CardBody>
      </Card>
    </div>
  );
}

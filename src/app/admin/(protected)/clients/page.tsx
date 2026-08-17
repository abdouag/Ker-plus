import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { FILTER_INPUT_CLASS, FilterBar, FilterField } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { CustomerNotesForm } from '@/components/admin/CustomerNotesForm';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { getCsrfToken } from '@/lib/security/csrf';
import {
  buildQueryString,
  customerWhere,
  PAGE_SIZE,
  parsePage,
  type ListParams,
} from '@/lib/admin/queries';

export const metadata: Metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireAdmin('/admin/clients');
  const params = await searchParams;
  const page = parsePage(params.page);
  const where = customerWhere(params);
  const csrfToken = await getCsrfToken();

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: {
        simulations: { orderBy: { createdAt: 'desc' }, take: 5 },
        orders: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const exportHref = `/api/admin/export/clients?${buildQueryString({
    q: params.q,
    from: params.from,
    to: params.to,
  })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Clients et prospects</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Coordonnées, historique des simulations et des commandes.
        </p>
      </div>

      <FilterBar action="/admin/clients" exportHref={exportHref}>
        <FilterField label="Recherche">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Nom, email ou téléphone"
            className={`${FILTER_INPUT_CLASS} w-72`}
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

      {customers.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Aucun client"
              description="Aucun client ne correspond à ces critères."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {customers.map((customer) => (
            <Card key={customer.id}>
              <CardBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
                <div>
                  <h2 className="text-base font-bold">
                    {customer.firstName} {customer.lastName}
                  </h2>
                  <dl className="mt-2 space-y-1 text-sm text-ink-soft">
                    <div>
                      <dt className="inline text-ink-muted">Email : </dt>
                      <dd className="inline">
                        <a href={`mailto:${customer.email}`} className="underline">
                          {customer.email}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-ink-muted">Téléphone : </dt>
                      <dd className="inline">{formatPhone(customer.phone)}</dd>
                    </div>
                    {customer.whatsapp ? (
                      <div>
                        <dt className="inline text-ink-muted">WhatsApp : </dt>
                        <dd className="inline">{formatPhone(customer.whatsapp)}</dd>
                      </div>
                    ) : null}
                    {customer.city ? (
                      <div>
                        <dt className="inline text-ink-muted">Ville du projet : </dt>
                        <dd className="inline">{customer.city}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="inline text-ink-muted">Consentement : </dt>
                      <dd className="inline">
                        {customer.consentAt ? formatDate(customer.consentAt) : 'Non renseigné'}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-ink-muted">Inscrit le : </dt>
                      <dd className="inline">{formatDateTime(customer.createdAt)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase text-ink-muted">
                      Simulations ({customer.simulations.length})
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {customer.simulations.map((simulation) => (
                        <li key={simulation.id} className="text-ink-soft">
                          {simulation.reference} — {simulation.projectTypeNameSnapshot},{' '}
                          {simulation.surface} m², {simulation.cityNameSnapshot}
                        </li>
                      ))}
                      {customer.simulations.length === 0 ? (
                        <li className="text-ink-muted">Aucune</li>
                      ) : null}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-ink-muted">
                      Commandes ({customer.orders.length})
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {customer.orders.map((order) => (
                        <li key={order.id}>
                          <Link
                            href={`/admin/commandes/${order.id}`}
                            className="text-forest-600 underline"
                          >
                            {order.reference}
                          </Link>{' '}
                          <span className="text-ink-muted">— {order.status}</span>
                        </li>
                      ))}
                      {customer.orders.length === 0 ? (
                        <li className="text-ink-muted">Aucune</li>
                      ) : null}
                    </ul>
                  </div>
                </div>

                <CustomerNotesForm
                  customerId={customer.id}
                  notes={customer.internalNotes ?? ''}
                  csrfToken={csrfToken}
                />
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardBody className="p-0 sm:p-0">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                basePath="/admin/clients"
                params={params as Record<string, string | undefined>}
              />
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

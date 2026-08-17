import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { FILTER_INPUT_CLASS, FilterBar, FilterField } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { formatDate, formatDateTime, formatXOF } from '@/lib/format';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/services/orders';
import {
  buildQueryString,
  orderWhere,
  PAGE_SIZE,
  parsePage,
  type ListParams,
} from '@/lib/admin/queries';

export const metadata: Metadata = { title: 'Commandes' };
export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  DRAFT: 'neutral',
  AWAITING_PAYMENT: 'warning',
  PAID: 'success',
  IN_PREPARATION: 'info',
  READY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
} as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireAdmin('/admin/commandes');
  const params = await searchParams;
  const page = parsePage(params.page);
  const where = orderWhere(params);
  const now = new Date();

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        customer: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        report: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const exportHref = `/api/admin/export/commandes?${buildQueryString({
    q: params.q,
    from: params.from,
    to: params.to,
    statut: params.statut,
  })}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Commandes</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Suivi des commandes de rapport, du paiement à la livraison.
        </p>
      </div>

      <FilterBar action="/admin/commandes" exportHref={exportHref}>
        <FilterField label="Recherche">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Référence, nom, email"
            className={`${FILTER_INPUT_CLASS} w-64`}
          />
        </FilterField>
        <FilterField label="Statut">
          <select name="statut" defaultValue={params.statut ?? ''} className={FILTER_INPUT_CLASS}>
            <option value="">Tous</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
          {orders.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Aucune commande"
                description="Aucune commande ne correspond à ces critères."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-sand-50 text-left text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Référence</th>
                    <th className="px-4 py-2 font-semibold">Client</th>
                    <th className="px-4 py-2 font-semibold">Montant</th>
                    <th className="px-4 py-2 font-semibold">Commande</th>
                    <th className="px-4 py-2 font-semibold">Paiement</th>
                    <th className="px-4 py-2 font-semibold">Échéance</th>
                    <th className="px-4 py-2 font-semibold">Créée le</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const payment = order.payments[0];
                    const late =
                      order.dueAt !== null &&
                      order.dueAt < now &&
                      !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status);
                    return (
                      <tr key={order.id} className="border-t border-sand-200">
                        <td className="px-4 py-2.5 font-semibold">
                          <Link
                            href={`/admin/commandes/${order.id}`}
                            className="text-forest-600 underline"
                          >
                            {order.reference}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          {order.customer.firstName} {order.customer.lastName}
                          <span className="block text-xs text-ink-muted">
                            {order.customer.email}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{formatXOF(order.amount)}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={STATUS_TONE[order.status]}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {payment ? (
                            <Badge tone={payment.status === 'PAID' ? 'success' : 'warning'}>
                              {PAYMENT_STATUS_LABELS[payment.status]}
                            </Badge>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-2.5 ${late ? 'font-semibold text-red-700' : 'text-ink-muted'}`}
                        >
                          {order.dueAt ? formatDate(order.dueAt) : '—'}
                          {late ? <span className="block text-xs">En retard</span> : null}
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted">
                          {formatDateTime(order.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/admin/commandes"
            params={params as Record<string, string | undefined>}
          />
        </CardBody>
      </Card>
    </div>
  );
}

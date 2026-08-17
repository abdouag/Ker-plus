import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { formatDateTime, formatXOF } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/services/orders';

export const metadata: Metadata = { title: 'Rapports' };
export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  await requireAdmin('/admin/rapports');
  const now = new Date();

  const [toPrepare, ready, delivered] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ['PAID', 'IN_PREPARATION'] } },
      include: { customer: true, report: true, simulation: true },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    }),
    prisma.order.findMany({
      where: { status: 'READY' },
      include: { customer: true, report: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    prisma.order.findMany({
      where: { status: 'DELIVERED' },
      include: { customer: true, report: true },
      orderBy: { deliveredAt: 'desc' },
      take: 25,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Rapports</h1>
        <p className="mt-1 text-sm text-ink-muted">
          File de préparation, rapports prêts à envoyer et rapports livrés.
        </p>
      </div>

      <Card>
        <CardHeader
          title="À préparer"
          description="Commandes payées dont le rapport n’est pas encore prêt."
          action={
            <Badge tone={toPrepare.length > 0 ? 'warning' : 'neutral'}>{toPrepare.length}</Badge>
          }
        />
        <CardBody className="p-0 sm:p-0">
          {toPrepare.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Aucun rapport en attente" description="La file est vide." />
            </div>
          ) : (
            <ul className="divide-y divide-sand-200">
              {toPrepare.map((order) => {
                const late = order.dueAt !== null && order.dueAt < now;
                return (
                  <li key={order.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Link
                      href={`/admin/commandes/${order.id}`}
                      className="font-semibold text-forest-600 underline"
                    >
                      {order.reference}
                    </Link>
                    <span className="text-sm">
                      {order.customer.firstName} {order.customer.lastName}
                    </span>
                    {order.simulation ? (
                      <span className="text-sm text-ink-muted">
                        {order.simulation.projectTypeNameSnapshot} — {order.simulation.surface} m² —{' '}
                        {formatXOF(order.simulation.estimatedTotal)}
                      </span>
                    ) : null}
                    <span
                      className={`ml-auto text-sm ${late ? 'font-semibold text-red-700' : 'text-ink-muted'}`}
                    >
                      {order.dueAt ? `Échéance ${formatDateTime(order.dueAt)}` : 'Sans échéance'}
                      {late ? ' — en retard' : ''}
                    </span>
                    <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Prêts à envoyer"
          action={<Badge tone={ready.length > 0 ? 'info' : 'neutral'}>{ready.length}</Badge>}
        />
        <CardBody className="p-0 sm:p-0">
          {ready.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Aucun rapport prêt" />
            </div>
          ) : (
            <ul className="divide-y divide-sand-200">
              {ready.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link
                    href={`/admin/commandes/${order.id}`}
                    className="font-semibold text-forest-600 underline"
                  >
                    {order.reference}
                  </Link>
                  <span className="text-sm">
                    {order.customer.firstName} {order.customer.lastName}
                  </span>
                  <span className="ml-auto text-sm text-ink-muted">
                    {order.report?.fileName ?? 'PDF non généré'}
                  </span>
                  <a
                    href={`/admin/rapports/${order.id}/apercu`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-forest-600 underline"
                  >
                    Prévisualiser
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Livrés" action={<Badge tone="success">{delivered.length}</Badge>} />
        <CardBody className="p-0 sm:p-0">
          {delivered.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Aucun rapport livré" />
            </div>
          ) : (
            <ul className="divide-y divide-sand-200">
              {delivered.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link
                    href={`/admin/commandes/${order.id}`}
                    className="font-semibold text-forest-600 underline"
                  >
                    {order.reference}
                  </Link>
                  <span className="text-sm">
                    {order.customer.firstName} {order.customer.lastName}
                  </span>
                  <span className="ml-auto text-sm text-ink-muted">
                    Livré le {formatDateTime(order.deliveredAt)} —{' '}
                    {order.report?.downloadCount ?? 0} téléchargement(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

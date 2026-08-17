import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { StatCard } from '@/components/admin/StatCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { formatDateTime, formatXOF, formatXOFCompact } from '@/lib/format';
import { conversionRate, startOfDay, startOfMonth } from '@/lib/dates';
import { ORDER_STATUS_LABELS } from '@/lib/services/orders';

export const metadata: Metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireAdmin('/admin/dashboard');

  const dayStart = startOfDay();
  const monthStart = startOfMonth();
  const now = new Date();

  const [
    simulationsToday,
    simulationsMonth,
    simulationsTotal,
    prospects,
    ordersAwaitingPayment,
    ordersPaid,
    ordersTotal,
    reportsToPrepare,
    reportsLate,
    revenue,
    recentOrders,
  ] = await Promise.all([
    prisma.simulation.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.simulation.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.simulation.count(),
    prisma.customer.count(),
    prisma.order.count({ where: { status: 'AWAITING_PAYMENT' } }),
    prisma.order.count({
      where: { status: { in: ['PAID', 'IN_PREPARATION', 'READY', 'DELIVERED'] } },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ['PAID', 'IN_PREPARATION'] } } }),
    prisma.order.count({
      where: {
        status: { in: ['PAID', 'IN_PREPARATION', 'READY'] },
        dueAt: { lt: now },
      },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', verified: true },
      _sum: { amount: true },
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    }),
  ]);

  const revenueTotal = revenue._sum.amount ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Tableau de bord</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Activité de l’estimateur et suivi des commandes (fuseau Africa/Dakar).
        </p>
      </div>

      <section aria-labelledby="activite" className="space-y-3">
        <h2 id="activite" className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          Activité
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Simulations aujourd’hui"
            value={simulationsToday}
            href="/admin/simulations"
          />
          <StatCard
            label="Simulations ce mois"
            value={simulationsMonth}
            href="/admin/simulations"
          />
          <StatCard label="Prospects enregistrés" value={prospects} href="/admin/clients" />
          <StatCard
            label="Chiffre d’affaires encaissé"
            value={formatXOFCompact(revenueTotal)}
            hint={formatXOF(revenueTotal)}
            href="/admin/paiements"
            tone="success"
          />
        </div>
      </section>

      <section aria-labelledby="commandes" className="space-y-3">
        <h2 id="commandes" className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          Commandes et rapports
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="En attente de paiement"
            value={ordersAwaitingPayment}
            href="/admin/commandes?statut=AWAITING_PAYMENT"
            tone={ordersAwaitingPayment > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Commandes payées"
            value={ordersPaid}
            href="/admin/commandes?statut=PAID"
          />
          <StatCard
            label="Rapports à préparer"
            value={reportsToPrepare}
            href="/admin/rapports"
            tone={reportsToPrepare > 0 ? 'warning' : 'default'}
          />
          <StatCard
            label="Rapports en retard"
            value={reportsLate}
            hint="Échéance dépassée, rapport non livré"
            href="/admin/rapports"
            tone={reportsLate > 0 ? 'danger' : 'default'}
          />
        </div>
      </section>

      <section aria-labelledby="conversion" className="space-y-3">
        <h2 id="conversion" className="text-sm font-bold uppercase tracking-wide text-ink-muted">
          Conversion
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Simulation → commande"
            value={`${conversionRate(ordersTotal, simulationsTotal)} %`}
            hint={`${ordersTotal} commande(s) pour ${simulationsTotal} simulation(s)`}
          />
          <StatCard
            label="Commande → paiement"
            value={`${conversionRate(ordersPaid, ordersTotal)} %`}
            hint={`${ordersPaid} commande(s) payée(s) sur ${ordersTotal}`}
          />
        </div>
      </section>

      <Card>
        <CardHeader
          title="Dernières commandes"
          action={
            <Link
              href="/admin/commandes"
              className="text-sm font-semibold text-forest-600 underline"
            >
              Voir toutes les commandes
            </Link>
          }
        />
        <CardBody className="p-0 sm:p-0">
          {recentOrders.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Aucune commande pour le moment"
                description="Les commandes créées depuis l’estimateur apparaîtront ici."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-sand-50 text-left text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Référence</th>
                    <th className="px-4 py-2 font-semibold">Client</th>
                    <th className="px-4 py-2 font-semibold">Montant</th>
                    <th className="px-4 py-2 font-semibold">Statut</th>
                    <th className="px-4 py-2 font-semibold">Créée le</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
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
                      </td>
                      <td className="px-4 py-2.5">{formatXOF(order.amount)}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={order.status === 'AWAITING_PAYMENT' ? 'warning' : 'neutral'}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">
                        {formatDateTime(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

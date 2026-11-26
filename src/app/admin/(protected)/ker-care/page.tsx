import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { computeIndicators } from '@/lib/care/services/admin';
import { ACTIVE_STATUSES } from '@/lib/care/workflow';
import { formatDateTime, formatXOF } from '@/lib/format';
import { REQUEST_KIND_LABELS } from '@/lib/care/constants';
import { StatCard } from '@/components/admin/StatCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert, Badge, EmptyState } from '@/components/ui/Feedback';
import { RequestStatusBadge } from '@/components/care/StatusBadge';

export const metadata: Metadata = { title: 'Kër Care' };
export const dynamic = 'force-dynamic';

function pct(value: number | null): string {
  return value === null ? '—' : `${value.toString().replace('.', ',')} %`;
}

function duration(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
  return `${Math.round(hours / 24)} j`;
}

export default async function CareAdminDashboardPage() {
  await requireAdmin('/admin/ker-care');
  const [indicators, urgent] = await Promise.all([
    computeIndicators(30),
    prisma.serviceRequest.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [{ kind: 'EMERGENCY' }, { status: { in: ['SUBMITTED', 'SEARCHING', 'DISPUTED'] } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      include: { category: { select: { name: true } }, property: { select: { commune: true } } },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Kër Care</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Maintenance, dépannage et carnet numérique — indicateurs des {indicators.periodDays}{' '}
          derniers jours, calculés uniquement à partir des données enregistrées.
        </p>
      </div>

      <section aria-labelledby="a-faire" className="space-y-3">
        <h2 id="a-faire" className="text-lg font-bold">
          À traiter
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            label="Demandes à affecter"
            value={indicators.toAssign}
            tone={indicators.toAssign ? 'warning' : 'default'}
            href="/admin/ker-care/demandes?statut=a-affecter"
          />
          <StatCard
            label="À clôturer ou contestées"
            value={indicators.toClose}
            tone={indicators.toClose ? 'warning' : 'default'}
            href="/admin/ker-care/demandes?statut=a-cloturer"
          />
          <StatCard
            label="Prestataires à vérifier"
            value={indicators.pendingVerification}
            tone={indicators.pendingVerification ? 'warning' : 'default'}
            href="/admin/ker-care/prestataires"
          />
        </div>
      </section>

      <section aria-labelledby="indicateurs" className="space-y-3">
        <h2 id="indicateurs" className="text-lg font-bold">
          Indicateurs (30 jours)
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Demandes reçues" value={indicators.received} />
          <StatCard
            label="Délai médian de première réponse"
            value={duration(indicators.medianFirstResponseMinutes)}
            hint="De la demande à la première affectation"
          />
          <StatCard label="Taux d’affectation" value={pct(indicators.assignmentRate)} />
          <StatCard
            label="Devis acceptés"
            value={pct(indicators.quoteAcceptanceRate)}
            hint="Parmi les devis acceptés ou refusés"
          />
          <StatCard
            label="Interventions validées / clôturées"
            value={pct(indicators.closureRate)}
            hint="Hors demandes annulées"
          />
          <StatCard label="Annulations" value={indicators.cancellations} />
          <StatCard
            label="Contestations en cours"
            value={indicators.disputes}
            tone={indicators.disputes ? 'danger' : 'default'}
          />
          <StatCard
            label="Satisfaction"
            value={
              indicators.averageRating === null
                ? '—'
                : `${indicators.averageRating.toString().replace('.', ',')} / 5`
            }
            hint={indicators.reviewCount ? `${indicators.reviewCount} avis` : 'Aucun avis'}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard
            label="Montant des devis acceptés (hors paiement)"
            value={formatXOF(indicators.acceptedQuotesTotal)}
            hint="Engagements clients, pas des encaissements"
          />
          <StatCard
            label="Revenus confirmés"
            value="—"
            hint="Non disponibles : paiements non intégrés"
          />
        </div>
      </section>

      <Card as="section">
        <CardHeader
          title="Urgences, demandes sans prestataire et contestations"
          action={
            <Link
              href="/admin/ker-care/demandes"
              className="text-sm font-semibold text-forest-600 underline"
            >
              Toutes les demandes
            </Link>
          }
        />
        <CardBody>
          {urgent.length === 0 ? (
            <EmptyState
              title="Rien à signaler"
              description="Aucune demande urgente ou en attente d’affectation."
            />
          ) : (
            <ul className="divide-y divide-sand-200">
              {urgent.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <Link
                    href={`/admin/ker-care/demandes/${request.id}`}
                    className="font-semibold text-forest-600 underline"
                  >
                    {request.reference}
                  </Link>
                  <span className="text-sm text-ink-soft">
                    {request.category.name} · {request.property.commune} ·{' '}
                    {formatDateTime(request.createdAt)}
                  </span>
                  <span className="flex gap-2">
                    {request.kind === 'EMERGENCY' ? (
                      <Badge tone="danger">{REQUEST_KIND_LABELS.EMERGENCY}</Badge>
                    ) : null}
                    <RequestStatusBadge status={request.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Alert tone="neutral">
        Commission, délais de validité des devis, consignes d’urgence et conditions d’annulation se
        règlent dans{' '}
        <Link href="/admin/parametres" className="font-semibold underline">
          Paramètres › Kër Care
        </Link>
        .
      </Alert>
    </div>
  );
}

import type { Metadata } from 'next';
import { requireProviderPage } from '@/lib/auth/account-guard';
import { listProviderMissions } from '@/lib/care/services/requests';
import { providerRatings } from '@/lib/care/services/accounts';
import { startOfDay } from '@/lib/dates';
import { formatDateTime } from '@/lib/format';
import { APPOINTMENT_TYPE_LABELS } from '@/lib/care/constants';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { StatCard } from '@/components/admin/StatCard';
import { MissionCard, type MissionSummary } from '@/components/care/provider/MissionCard';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

const ON_SITE = ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'];
const FINISHED = ['VALIDATED', 'CLOSED', 'CANCELLED'];

export default async function ProviderDashboardPage() {
  const account = await requireProviderPage('/ker-care/prestataire');
  const providerId = account.providerProfile.id;
  const [assignments, ratings] = await Promise.all([
    listProviderMissions(providerId),
    providerRatings(),
  ]);
  const rating = ratings.get(providerId);

  const toSummary = (assignment: (typeof assignments)[number]): MissionSummary => {
    const next = assignment.request.appointments[0];
    return {
      reference: assignment.request.reference,
      status: assignment.request.status,
      kind: assignment.request.kind,
      categoryName: assignment.request.category.name,
      commune: assignment.request.property.commune,
      quartier: assignment.request.property.quartier,
      createdAt: assignment.request.createdAt,
      nextAppointment: next
        ? { startsAt: next.startsAt, confirmed: next.status === 'CONFIRMED' }
        : null,
    };
  };

  const pending = assignments.filter((a) => a.status === 'PENDING');
  const accepted = assignments.filter((a) => a.status === 'ACCEPTED');
  const onSite = accepted.filter((a) => ON_SITE.includes(a.request.status));
  const history = accepted.filter((a) => FINISHED.includes(a.request.status));
  const other = accepted.filter(
    (a) => !ON_SITE.includes(a.request.status) && !FINISHED.includes(a.request.status),
  );

  const dayStart = startOfDay();
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const today = accepted
    .flatMap((a) =>
      a.request.appointments
        .filter(
          (ap) => ap.status === 'CONFIRMED' && ap.startsAt >= dayStart && ap.startsAt < dayEnd,
        )
        .map((ap) => ({
          ...ap,
          reference: a.request.reference,
          category: a.request.category.name,
        })),
    )
    .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-700">Bonjour {account.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">Vos missions Kër Care affectées par Kerplus.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="À accepter"
          value={pending.length}
          tone={pending.length ? 'warning' : 'default'}
        />
        <StatCard label="Rendez-vous aujourd’hui" value={today.length} />
        <StatCard label="Interventions à clôturer" value={onSite.length} />
        <StatCard
          label="Note moyenne"
          value={rating ? `${rating.average.toFixed(1).replace('.', ',')} / 5` : '—'}
          hint={rating ? `${rating.count} avis` : 'Aucun avis pour le moment'}
        />
      </div>
      <p className="text-sm text-ink-muted">
        Revenus : paiements non intégrés — revenus non disponibles dans l’espace prestataire.
      </p>

      <Card as="section">
        <CardHeader title="Missions en attente de votre réponse" />
        <CardBody>
          {pending.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {pending.map((a) => (
                <MissionCard key={a.id} mission={toSummary(a)} />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Aucune mission en attente"
              description="Les nouvelles missions affectées par Kerplus apparaîtront ici."
            />
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader title="Rendez-vous du jour" description="Heure de Dakar (GMT)." />
        <CardBody>
          {today.length ? (
            <ul className="space-y-2">
              {today.map((ap) => (
                <li key={ap.id}>
                  <Link
                    href={`/ker-care/prestataire/missions/${ap.reference}`}
                    className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2 hover:border-forest-300"
                  >
                    <span className="font-semibold text-forest-700">
                      {formatDateTime(ap.startsAt)}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {APPOINTMENT_TYPE_LABELS[ap.type]} · {ap.category} · {ap.reference}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucun rendez-vous confirmé aujourd’hui.</p>
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader title="Interventions planifiées ou en cours" />
        <CardBody>
          {onSite.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {onSite.map((a) => (
                <MissionCard key={a.id} mission={toSummary(a)} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucune intervention planifiée.</p>
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Autres missions actives"
          description="Devis, créneaux à proposer, validation client…"
        />
        <CardBody>
          {other.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {other.map((a) => (
                <MissionCard key={a.id} mission={toSummary(a)} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucune autre mission active.</p>
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader title="Historique" />
        <CardBody>
          {history.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {history.map((a) => (
                <MissionCard key={a.id} mission={toSummary(a)} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucune mission terminée pour le moment.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

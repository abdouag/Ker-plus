import type { Metadata } from 'next';
import Link from 'next/link';
import { requireClientPage } from '@/lib/auth/account-guard';
import { listClientRequests } from '@/lib/care/services/requests';
import { REQUEST_KIND_LABELS, REQUEST_NEXT_STEP_CLIENT } from '@/lib/care/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { LinkButton } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/Feedback';

export const metadata: Metadata = {
  title: 'Mes interventions — Kër Care',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ClientRequestsPage() {
  const account = await requireClientPage('/ker-care/mon-espace/demandes');
  const requests = await listClientRequests(account.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-700">Mes interventions</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Suivez vos demandes de dépannage et d’entretien, du devis jusqu’à la clôture.
          </p>
        </div>
        <LinkButton href="/ker-care/mon-espace/demandes/nouvelle" className="shrink-0">
          Signaler un problème
        </LinkButton>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="Aucune demande pour le moment"
          description="Une fuite, une panne de climatiseur, un entretien à prévoir ? Décrivez votre besoin : Kerplus recherche un prestataire vérifié."
          action={
            <LinkButton href="/ker-care/mon-espace/demandes/nouvelle">
              Signaler un problème
            </LinkButton>
          }
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => {
            const nextAppointment = request.appointments[0];
            const quoteToReview = request.quotes.length > 0;
            return (
              <li key={request.id}>
                <Link
                  href={`/ker-care/mon-espace/demandes/${request.reference}`}
                  className="block rounded-2xl border border-sand-200 bg-white p-4 shadow-card transition-colors hover:border-forest-300 focus-visible:outline-offset-2 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-forest-700">
                        {request.category.name}
                        {request.equipment ? ` — ${request.equipment.name}` : ''}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {request.reference} · {request.property.name} ·{' '}
                        {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {quoteToReview ? <Badge tone="warning">Devis à valider</Badge> : null}
                      {request.kind === 'EMERGENCY' ? (
                        <Badge tone="danger">{REQUEST_KIND_LABELS.EMERGENCY}</Badge>
                      ) : null}
                      <RequestStatusBadge status={request.status} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {REQUEST_NEXT_STEP_CLIENT[request.status]}
                  </p>
                  {nextAppointment ? (
                    <p className="mt-1 text-sm font-semibold text-forest-600">
                      {nextAppointment.status === 'CONFIRMED' ? 'Rendez-vous' : 'Créneau proposé'} :{' '}
                      {formatDateTime(nextAppointment.startsAt)} (heure de Dakar)
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

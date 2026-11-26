import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { requireClientPage } from '@/lib/auth/account-guard';
import { listProperties, listTasks } from '@/lib/care/services/properties';
import { listActiveRequests } from '@/lib/care/services/client-queries';
import { PROPERTY_TYPE_LABELS, REQUEST_NEXT_STEP_CLIENT } from '@/lib/care/constants';
import { isDueSoon, taskBucket } from '@/lib/care/maintenance';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Vue d’ensemble' };
export const dynamic = 'force-dynamic';

export default async function ClientOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ logement?: string }>;
}) {
  const account = await requireClientPage('/ker-care/mon-espace');
  const { logement } = await searchParams;
  const properties = await listProperties(account.id);

  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-forest-700">Bienvenue sur Kër Care</h1>
        <EmptyState
          title="Commencez par ajouter votre maison"
          description="Le carnet de votre logement regroupera ses équipements, les rappels d’entretien et l’historique des interventions."
          action={
            <LinkButton href="/ker-care/mon-espace/maisons/nouvelle">Ajouter ma maison</LinkButton>
          }
        />
      </div>
    );
  }

  const selected = properties.find((property) => property.id === logement) ?? properties[0];
  const [tasks, activeRequests] = await Promise.all([
    listTasks(account.id, selected.id),
    listActiveRequests(account.id, selected.id),
  ]);
  const now = new Date();
  const reminders = tasks
    .map((task) => ({ task, bucket: taskBucket(task, now) }))
    .filter(
      ({ task, bucket }) =>
        bucket === 'overdue' || (bucket === 'upcoming' && isDueSoon(task.dueAt, 30, now)),
    );
  const nextTasks = tasks.filter((task) => taskBucket(task, now) === 'upcoming').slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-forest-700">Vue d’ensemble</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {selected.name} · {PROPERTY_TYPE_LABELS[selected.type]} · {selected.commune}
            {selected.quartier ? `, ${selected.quartier}` : ''}
          </p>
        </div>
        <LinkButton
          href={`/ker-care/mon-espace/demandes/nouvelle?logement=${selected.id}`}
          size="lg"
          className="w-full sm:w-auto"
        >
          Signaler un problème
        </LinkButton>
      </div>

      {properties.length > 1 ? (
        <nav aria-label="Choisir un logement">
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {properties.map((property) => (
              <li key={property.id} className="shrink-0">
                <Link
                  href={`/ker-care/mon-espace?logement=${property.id}`}
                  aria-current={property.id === selected.id ? 'true' : undefined}
                  className={cn(
                    'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold',
                    property.id === selected.id
                      ? 'border-forest-600 bg-forest-600 text-white'
                      : 'border-sand-300 bg-white text-ink-soft hover:border-forest-300',
                  )}
                >
                  {property.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card as="section">
          <CardHeader
            title="Interventions en cours"
            action={
              <Link
                href="/ker-care/mon-espace/demandes"
                className="text-sm font-semibold text-forest-600 underline"
              >
                Toutes mes interventions
              </Link>
            }
          />
          <CardBody>
            {activeRequests.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Aucune intervention en cours pour ce logement.
              </p>
            ) : (
              <ul className="space-y-4">
                {activeRequests.map((request) => (
                  <li key={request.id} className="rounded-xl border border-sand-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/ker-care/mon-espace/demandes/${request.reference}`}
                        className="font-bold text-forest-700 underline-offset-2 hover:underline"
                      >
                        {request.category.name}
                        {request.equipment ? ` — ${request.equipment.name}` : ''}
                      </Link>
                      <RequestStatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{request.reference}</p>
                    <p className="mt-2 text-sm text-ink-soft">
                      {REQUEST_NEXT_STEP_CLIENT[request.status]}
                    </p>
                    {request.appointments[0] ? (
                      <p className="mt-1 text-sm text-forest-700">
                        Rendez-vous{' '}
                        {request.appointments[0].status === 'CONFIRMED' ? 'confirmé' : 'proposé'} :{' '}
                        {formatDateTime(request.appointments[0].startsAt)} (heure de Dakar)
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card as="section">
          <CardHeader
            title="Rappels d’entretien"
            action={
              <Link
                href="/ker-care/mon-espace/entretiens"
                className="text-sm font-semibold text-forest-600 underline"
              >
                Tous les entretiens
              </Link>
            }
          />
          <CardBody>
            {reminders.length === 0 ? (
              <div className="space-y-2 text-sm text-ink-muted">
                <p>Aucun entretien en retard ni prévu dans les 30 prochains jours.</p>
                {nextTasks.length > 0 ? (
                  <p>
                    Prochaine échéance : {nextTasks[0].title} le {formatDate(nextTasks[0].dueAt)}.
                  </p>
                ) : (
                  <p>
                    Ajoutez vos équipements pour recevoir des rappels :{' '}
                    <Link
                      href={`/ker-care/mon-espace/maisons/${selected.id}#equipements`}
                      className="font-semibold text-forest-600 underline"
                    >
                      gérer les équipements
                    </Link>
                    .
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {reminders.map(({ task, bucket }) => (
                  <li
                    key={task.id}
                    className="flex flex-col gap-2 rounded-xl border border-sand-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-forest-700">{task.title}</p>
                      <p className="text-sm text-ink-soft">
                        {bucket === 'overdue' ? (
                          <Badge tone="danger">En retard</Badge>
                        ) : (
                          <Badge tone="warning">Bientôt</Badge>
                        )}{' '}
                        Échéance : {formatDate(task.dueAt)}
                      </p>
                    </div>
                    <LinkButton
                      href={`/ker-care/mon-espace/demandes/nouvelle?logement=${task.propertyId}${task.equipmentId ? `&equipement=${task.equipmentId}` : ''}&tache=${task.id}`}
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                    >
                      Demander l’entretien
                    </LinkButton>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card as="section">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-forest-700">Carnet de {selected.name}</p>
            <p className="text-sm text-ink-soft">
              {selected._count.equipments} équipement(s) · {selected._count.requests} demande(s)
              d’intervention
            </p>
          </div>
          <LinkButton
            href={`/ker-care/mon-espace/maisons/${selected.id}`}
            variant="secondary"
            size="sm"
          >
            Ouvrir le carnet
          </LinkButton>
        </CardBody>
      </Card>
    </div>
  );
}

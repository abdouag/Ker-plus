import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { SelectField, TextField } from '@/components/ui/Field';
import { CareForm } from '@/components/care/CareForm';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { createTaskAction, taskAction } from '@/app/ker-care/actions/client';
import { requireClientPage } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { listTasks } from '@/lib/care/services/properties';
import { listPropertiesWithEquipments } from '@/lib/care/services/client-queries';
import { TASK_BUCKET_LABELS, taskBucket, type TaskBucket } from '@/lib/care/maintenance';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Entretiens' };
export const dynamic = 'force-dynamic';

const BUCKETS: {
  key: TaskBucket;
  tone: 'danger' | 'info' | 'success' | 'neutral';
  empty: string;
}[] = [
  { key: 'overdue', tone: 'danger', empty: 'Aucun entretien en retard.' },
  { key: 'upcoming', tone: 'info', empty: 'Aucun entretien à prévoir.' },
  { key: 'planned', tone: 'success', empty: 'Aucun entretien planifié avec un prestataire.' },
  { key: 'done', tone: 'neutral', empty: 'Aucun entretien effectué pour le moment.' },
];

function inputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ logement?: string }>;
}) {
  const account = await requireClientPage('/ker-care/mon-espace/entretiens');
  const { logement } = await searchParams;
  const [allTasks, properties, csrfToken] = await Promise.all([
    listTasks(account.id),
    listPropertiesWithEquipments(account.id),
    getCsrfToken(),
  ]);

  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-forest-700">Entretiens</h1>
        <EmptyState
          title="Ajoutez d’abord votre maison"
          description="Les entretiens sont rattachés à un logement et, si vous le souhaitez, à un équipement."
          action={
            <LinkButton href="/ker-care/mon-espace/maisons/nouvelle">Ajouter ma maison</LinkButton>
          }
        />
      </div>
    );
  }

  const selectedProperty = properties.find((property) => property.id === logement);
  const tasks = selectedProperty
    ? allTasks.filter((task) => task.propertyId === selectedProperty.id)
    : allTasks;
  const now = new Date();
  const grouped = new Map<TaskBucket, typeof tasks>();
  for (const task of tasks) {
    const bucket = taskBucket(task, now);
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), task]);
  }
  // Les effectués les plus récents d'abord.
  grouped.set(
    'done',
    (grouped.get('done') ?? []).sort(
      (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
    ),
  );
  const hasAny = tasks.some((task) => task.status !== 'CANCELLED');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-700">Entretiens</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Les échéances sont calculées à partir des fréquences indicatives de vos équipements ; vous
          pouvez les reporter ou les ajuster à tout moment.
        </p>
      </div>

      {properties.length > 1 ? (
        <nav aria-label="Filtrer par logement">
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {[{ id: '', name: 'Tous les logements' }, ...properties].map((property) => {
              const active = (selectedProperty?.id ?? '') === property.id;
              return (
                <li key={property.id || 'tous'} className="shrink-0">
                  <Link
                    href={
                      property.id
                        ? `/ker-care/mon-espace/entretiens?logement=${property.id}`
                        : '/ker-care/mon-espace/entretiens'
                    }
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold',
                      active
                        ? 'border-forest-600 bg-forest-600 text-white'
                        : 'border-sand-300 bg-white text-ink-soft hover:border-forest-300',
                    )}
                  >
                    {property.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {!hasAny ? (
        <EmptyState
          title="Aucun entretien enregistré"
          description="Ajoutez vos équipements dans le carnet de votre maison pour générer automatiquement les rappels, ou créez un entretien ci-dessous."
          action={
            <LinkButton
              href={`/ker-care/mon-espace/maisons/${(selectedProperty ?? properties[0]).id}#equipements`}
              size="sm"
            >
              Ajouter un équipement
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-6">
          {BUCKETS.map(({ key, tone, empty }) => {
            const items = grouped.get(key) ?? [];
            return (
              <Card as="section" key={key}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {TASK_BUCKET_LABELS[key]}
                      <Badge tone={tone}>{items.length}</Badge>
                    </span>
                  }
                />
                <CardBody>
                  {items.length === 0 ? (
                    <p className="text-sm text-ink-muted">{empty}</p>
                  ) : (
                    <ul className="space-y-3">
                      {(key === 'done' ? items.slice(0, 20) : items).map((task) => (
                        <li key={task.id} className="rounded-xl border border-sand-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-forest-700">{task.title}</p>
                              <p className="text-sm text-ink-soft">
                                {task.property.name}
                                {task.equipment ? ` · ${task.equipment.name}` : ''}
                                {task.frequencyMonths
                                  ? ` · tous les ${task.frequencyMonths} mois (indicatif)`
                                  : ''}
                              </p>
                              <p className="text-sm text-ink-muted">
                                {key === 'done'
                                  ? `Effectué le ${formatDate(task.completedAt)}`
                                  : `Échéance : ${formatDate(task.dueAt)}`}
                              </p>
                              {task.recommendation ? (
                                <p className="mt-1 text-sm text-ink-soft">{task.recommendation}</p>
                              ) : null}
                            </div>
                            {task.request ? (
                              <Link
                                href={`/ker-care/mon-espace/demandes/${task.request.reference}`}
                                className="flex items-center gap-2 text-sm font-semibold text-forest-600 underline"
                              >
                                {task.request.reference}
                                <RequestStatusBadge status={task.request.status} />
                              </Link>
                            ) : null}
                          </div>

                          {key === 'overdue' || key === 'upcoming' ? (
                            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                              <LinkButton
                                href={`/ker-care/mon-espace/demandes/nouvelle?logement=${task.propertyId}${task.equipmentId ? `&equipement=${task.equipmentId}` : ''}&tache=${task.id}`}
                                size="sm"
                              >
                                Demander une intervention
                              </LinkButton>
                              <CareForm
                                action={taskAction}
                                csrfToken={csrfToken}
                                hidden={{ taskId: task.id, operation: 'complete' }}
                                submitLabel="Marquer comme effectué"
                                variant="secondary"
                                size="sm"
                                className="[&>div:last-child]:mt-0"
                              />
                              <CareForm
                                action={taskAction}
                                csrfToken={csrfToken}
                                hidden={{ taskId: task.id, operation: 'postpone' }}
                                submitLabel="Reporter"
                                variant="ghost"
                                size="sm"
                                className="flex items-end gap-2 [&>div:last-child]:mt-0"
                              >
                                <TextField
                                  id={`postpone-${task.id}`}
                                  label="Nouvelle échéance"
                                  name="dueAt"
                                  type="date"
                                  required
                                  min={inputDate(now)}
                                  defaultValue={inputDate(task.dueAt < now ? now : task.dueAt)}
                                  className="py-2"
                                />
                              </CareForm>
                              <CareForm
                                action={taskAction}
                                csrfToken={csrfToken}
                                hidden={{ taskId: task.id, operation: 'cancel' }}
                                submitLabel="Annuler"
                                confirmMessage="Annuler cet entretien ?"
                                variant="ghost"
                                size="sm"
                                className="[&>div:last-child]:mt-0"
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card as="section">
        <CardHeader
          title="Ajouter un entretien"
          description="Par exemple : nettoyage du réservoir, contrôle de la toiture avant l’hivernage."
        />
        <CardBody>
          <CareForm
            action={createTaskAction}
            csrfToken={csrfToken}
            submitLabel="Ajouter l’entretien"
            resetOnSuccess
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Logement"
                name="propertyId"
                required
                defaultValue={(selectedProperty ?? properties[0]).id}
              >
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Équipement (facultatif)"
                name="equipmentId"
                defaultValue=""
                hint="L’équipement doit appartenir au logement choisi."
              >
                <option value="">Aucun</option>
                {properties.map((property) =>
                  property.equipments.length > 0 ? (
                    <optgroup key={property.id} label={property.name}>
                      {property.equipments.map((equipment) => (
                        <option key={equipment.id} value={equipment.id}>
                          {equipment.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null,
                )}
              </SelectField>
              <TextField label="Intitulé" name="title" required maxLength={120} />
              <TextField
                label="Échéance"
                name="dueAt"
                type="date"
                required
                defaultValue={inputDate(now)}
              />
              <TextField
                label="Fréquence (mois, facultatif)"
                name="frequencyMonths"
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                hint="Si renseignée, l’échéance suivante est créée une fois l’entretien effectué."
              />
              <TextField
                label="Recommandation (facultatif)"
                name="recommendation"
                maxLength={500}
              />
            </div>
          </CareForm>
        </CardBody>
      </Card>
    </div>
  );
}

import { Disclosure } from '@/components/care/Disclosure';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { SelectField, TextField } from '@/components/ui/Field';
import { IconFileText } from '@/components/ui/icons';
import { CareForm } from '@/components/care/CareForm';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { PropertyForm } from '@/components/care/client/PropertyForm';
import { EquipmentForm } from '@/components/care/client/EquipmentForm';
import {
  archiveDocumentAction,
  archiveEquipmentAction,
  archivePropertyAction,
  linkOrderAction,
  uploadDocumentsAction,
} from '@/app/ker-care/actions/client';
import { requireClientPage } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { CareError } from '@/lib/care/errors';
import { getPropertyNotebook } from '@/lib/care/services/properties';
import { listActiveEquipmentTypes } from '@/lib/care/services/client-queries';
import {
  ATTACHMENT_KIND_LABELS,
  MAINTENANCE_STATUS_LABELS,
  PROPERTY_DOCUMENT_KINDS,
  PROPERTY_TYPE_LABELS,
} from '@/lib/care/constants';
import { TASK_BUCKET_LABELS, taskBucket } from '@/lib/care/maintenance';
import { formatDate, formatXOF } from '@/lib/format';

export const metadata: Metadata = { title: 'Carnet du logement' };
export const dynamic = 'force-dynamic';

interface Filters {
  du?: string;
  au?: string;
  categorie?: string;
  equipement?: string;
}

function parseDay(value: string | undefined, endOfDay = false): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function PropertyNotebookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Filters>;
}) {
  const { id } = await params;
  const account = await requireClientPage(`/ker-care/mon-espace/maisons/${id}`);
  const filters = await searchParams;

  let property;
  try {
    property = await getPropertyNotebook(account.id, id);
  } catch (error) {
    if (error instanceof CareError) notFound();
    throw error;
  }
  const [csrfToken, equipmentTypes] = await Promise.all([
    getCsrfToken(),
    listActiveEquipmentTypes(),
  ]);
  const archived = Boolean(property.archivedAt);
  const now = new Date();

  const activeEquipments = property.equipments.filter((item) => !item.archivedAt);
  const archivedEquipments = property.equipments.filter((item) => item.archivedAt);
  const nextDueByEquipment = new Map<string, Date>();
  for (const task of property.tasks) {
    if (!task.equipmentId || (task.status !== 'TODO' && task.status !== 'PLANNED')) continue;
    const current = nextDueByEquipment.get(task.equipmentId);
    if (!current || task.dueAt < current) nextDueByEquipment.set(task.equipmentId, task.dueAt);
  }
  const openTasks = property.tasks.filter(
    (task) => task.status === 'TODO' || task.status === 'PLANNED',
  );

  // Historique filtré côté serveur.
  const from = parseDay(filters.du);
  const to = parseDay(filters.au, true);
  const history = property.requests.filter(
    (request) =>
      (!from || request.createdAt >= from) &&
      (!to || request.createdAt <= to) &&
      (!filters.categorie || request.category.slug === filters.categorie) &&
      (!filters.equipement || request.equipment?.id === filters.equipement),
  );
  const historyCategories = Array.from(
    new Map(property.requests.map((request) => [request.category.slug, request.category.name])),
  );
  const filtered = Boolean(filters.du || filters.au || filters.categorie || filters.equipement);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link
          href="/ker-care/mon-espace/maisons"
          className="font-semibold text-forest-600 underline"
        >
          ← Mes maisons
        </Link>
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-forest-700">{property.name}</h1>
            {archived ? <Badge>Archivé</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {PROPERTY_TYPE_LABELS[property.type]} · {property.commune}
            {property.quartier ? `, ${property.quartier}` : ''}
          </p>
        </div>
        {!archived ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <LinkButton href={`/ker-care/mon-espace/demandes/nouvelle?logement=${property.id}`}>
              Signaler un problème
            </LinkButton>
            <LinkButton
              href={`/ker-care/mon-espace/maisons/${property.id}/renovation`}
              variant="ghost"
            >
              Créer un projet de rénovation
            </LinkButton>
          </div>
        ) : null}
      </div>

      {archived ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm text-ink-soft">
              Ce logement est archivé : son historique reste consultable mais aucune nouvelle
              demande ne peut être créée.
            </p>
            <CareForm
              action={archivePropertyAction}
              csrfToken={csrfToken}
              hidden={{ propertyId: property.id, archived: 'false' }}
              submitLabel="Réactiver ce logement"
              variant="secondary"
              size="sm"
            />
          </CardBody>
        </Card>
      ) : null}

      {/* Fiche */}
      <Card as="section">
        <CardHeader title={<span id="fiche">Fiche du logement</span>} />
        <CardBody className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label="Repère" value={property.landmark || '—'} />
            <Fact label="Adresse" value={property.address || '—'} />
            <Fact label="Surface" value={property.surface ? `${property.surface} m²` : '—'} />
            <Fact label="Niveaux" value={property.levels ?? '—'} />
            <Fact label="Chambres" value={property.bedrooms ?? '—'} />
            <Fact label="Salles de bain" value={property.bathrooms ?? '—'} />
            <Fact label="Construction" value={property.yearBuilt ?? '—'} />
            <Fact label="Projet Kerplus" value={property.linkedOrderReference ?? '—'} />
          </dl>
          {!archived ? (
            <>
              <details className="rounded-xl border border-sand-200 px-4 py-3">
                <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-forest-700">
                  Modifier la fiche
                </summary>
                <div className="mt-3">
                  <PropertyForm csrfToken={csrfToken} property={property} />
                </div>
              </details>
              <details className="rounded-xl border border-sand-200 px-4 py-3">
                <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-forest-700">
                  Rattacher un projet Kerplus
                </summary>
                <p className="mt-2 text-sm text-ink-soft">
                  Vous avez commandé un rapport de construction Kerplus ? Indiquez sa référence :
                  elle doit avoir été passée avec la même adresse email que ce compte. Aucune
                  information n’est recréée ni recopiée.
                </p>
                <CareForm
                  action={linkOrderAction}
                  csrfToken={csrfToken}
                  hidden={{ propertyId: property.id }}
                  submitLabel="Rattacher"
                  variant="secondary"
                  size="sm"
                  className="mt-3 max-w-sm"
                >
                  <TextField
                    label="Référence de commande"
                    name="orderReference"
                    required
                    maxLength={40}
                    placeholder="KP-CMD-20260101-ABCD"
                    defaultValue={property.linkedOrderReference ?? ''}
                  />
                </CareForm>
              </details>
              <CareForm
                action={archivePropertyAction}
                csrfToken={csrfToken}
                hidden={{ propertyId: property.id, archived: 'true' }}
                submitLabel="Archiver ce logement"
                confirmMessage="Archiver ce logement ? Son historique restera consultable."
                variant="ghost"
                size="sm"
              />
            </>
          ) : null}
        </CardBody>
      </Card>

      {/* Équipements */}
      <Card as="section">
        <CardHeader
          title={<span id="equipements">Équipements</span>}
          description="Les échéances d’entretien proposées sont indicatives et restent modifiables."
        />
        <CardBody className="space-y-4">
          {activeEquipments.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Aucun équipement enregistré. Ajoutez par exemple vos climatiseurs, votre pompe ou
              votre chauffe-eau pour recevoir des rappels d’entretien.
            </p>
          ) : (
            <ul className="space-y-3">
              {activeEquipments.map((equipment) => {
                const nextDue = nextDueByEquipment.get(equipment.id);
                return (
                  <li key={equipment.id} className="rounded-xl border border-sand-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-forest-700">
                          {equipment.name}
                          {equipment.quantity > 1 ? ` × ${equipment.quantity}` : ''}
                        </p>
                        <p className="text-sm text-ink-soft">
                          {equipment.type?.name ?? 'Équipement personnalisé'}
                          {equipment.location ? ` · ${equipment.location}` : ''}
                          {equipment.brand ? ` · ${equipment.brand}` : ''}
                          {equipment.model ? ` ${equipment.model}` : ''}
                        </p>
                      </div>
                      {nextDue ? (
                        <Badge tone={nextDue < now ? 'danger' : 'info'}>
                          {nextDue < now
                            ? 'Entretien en retard'
                            : `Prochain entretien : ${formatDate(nextDue)}`}
                        </Badge>
                      ) : null}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Fact label="Installation" value={formatDate(equipment.installedAt)} />
                      <Fact label="Garantie" value={formatDate(equipment.warrantyUntil)} />
                      <Fact label="Dernier entretien" value={formatDate(equipment.lastServiceAt)} />
                      <Fact
                        label="Fréquence"
                        value={
                          (equipment.frequencyMonths ?? equipment.type?.defaultFrequencyMonths)
                            ? `${equipment.frequencyMonths ?? equipment.type?.defaultFrequencyMonths} mois (indicatif)`
                            : '—'
                        }
                      />
                    </dl>
                    {equipment.notes ? (
                      <p className="mt-2 text-sm text-ink-soft">{equipment.notes}</p>
                    ) : null}
                    {!archived ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <details className="rounded-xl border border-sand-200 px-3 py-2">
                          <summary className="min-h-[40px] cursor-pointer content-center text-sm font-semibold text-forest-700">
                            Modifier
                          </summary>
                          <div className="mt-3">
                            <EquipmentForm
                              csrfToken={csrfToken}
                              propertyId={property.id}
                              types={equipmentTypes}
                              equipment={equipment}
                            />
                          </div>
                        </details>
                        <div className="flex flex-wrap gap-2">
                          <LinkButton
                            href={`/ker-care/mon-espace/demandes/nouvelle?logement=${property.id}&equipement=${equipment.id}`}
                            size="sm"
                            variant="ghost"
                          >
                            Demander une intervention
                          </LinkButton>
                          <CareForm
                            action={archiveEquipmentAction}
                            csrfToken={csrfToken}
                            hidden={{ equipmentId: equipment.id, archived: 'true' }}
                            submitLabel="Archiver"
                            confirmMessage="Archiver cet équipement ? Son historique est conservé."
                            variant="ghost"
                            size="sm"
                            className="[&>div:last-child]:mt-0"
                          />
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {archivedEquipments.length > 0 ? (
            <details className="rounded-xl border border-sand-200 px-4 py-3">
              <summary className="min-h-[44px] cursor-pointer content-center text-sm font-semibold text-ink-soft">
                Équipements archivés ({archivedEquipments.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {archivedEquipments.map((equipment) => (
                  <li
                    key={equipment.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>{equipment.name}</span>
                    {!archived ? (
                      <CareForm
                        action={archiveEquipmentAction}
                        csrfToken={csrfToken}
                        hidden={{ equipmentId: equipment.id, archived: 'false' }}
                        submitLabel="Réactiver"
                        variant="ghost"
                        size="sm"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {!archived ? (
            <Disclosure
              className="rounded-xl border border-forest-200 bg-forest-50/50 px-4 py-3"
              defaultOpen={activeEquipments.length === 0}
              summaryClassName="min-h-[44px] cursor-pointer content-center text-sm font-bold text-forest-700"
              summary={<>+ Ajouter un équipement</>}
            >
              <div className="mt-3">
                <EquipmentForm
                  csrfToken={csrfToken}
                  propertyId={property.id}
                  types={equipmentTypes}
                />
              </div>
            </Disclosure>
          ) : null}
        </CardBody>
      </Card>

      {/* Entretiens */}
      <Card as="section">
        <CardHeader
          title="Entretiens à venir"
          action={
            <Link
              href="/ker-care/mon-espace/entretiens"
              className="text-sm font-semibold text-forest-600 underline"
            >
              Gérer les entretiens
            </Link>
          }
        />
        <CardBody>
          {openTasks.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucun entretien prévu pour ce logement.</p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {openTasks.map((task) => {
                const bucket = taskBucket(task, now);
                return (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-forest-700">{task.title}</p>
                      <p className="text-xs text-ink-muted">
                        Échéance : {formatDate(task.dueAt)}
                        {task.equipment ? ` · ${task.equipment.name}` : ''}
                      </p>
                    </div>
                    <Badge
                      tone={
                        bucket === 'overdue' ? 'danger' : bucket === 'planned' ? 'success' : 'info'
                      }
                    >
                      {bucket === 'planned'
                        ? MAINTENANCE_STATUS_LABELS.PLANNED
                        : TASK_BUCKET_LABELS[bucket]}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Documents */}
      <Card as="section">
        <CardHeader
          title={<span id="documents">Documents</span>}
          description="Plans, factures, garanties et photos. Fichiers privés : seuls vous et Kerplus y avez accès."
        />
        <CardBody className="space-y-4">
          {property.attachments.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucun document dans le carnet.</p>
          ) : (
            <ul className="divide-y divide-sand-100">
              {property.attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <a
                    href={`/ker-care/fichiers/${file.id}`}
                    target="_blank"
                    rel="noopener"
                    className="flex min-w-0 items-center gap-3"
                  >
                    {file.mimeType.startsWith('image/') ? (
                      // Fichier privé servi après contrôle d'accès : pas d'optimisation next/image.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/ker-care/fichiers/${file.id}`}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-lg bg-sand-100 object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sand-50 text-forest-600">
                        <IconFileText />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-forest-700 underline-offset-2 hover:underline">
                        {file.title || file.fileName}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {ATTACHMENT_KIND_LABELS[file.kind]} · {formatDate(file.createdAt)}
                      </span>
                    </span>
                  </a>
                  {!archived ? (
                    <CareForm
                      action={archiveDocumentAction}
                      csrfToken={csrfToken}
                      hidden={{ attachmentId: file.id }}
                      submitLabel="Retirer"
                      confirmMessage="Retirer ce document du carnet ?"
                      variant="ghost"
                      size="sm"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {!archived ? (
            <details className="rounded-xl border border-forest-200 bg-forest-50/50 px-4 py-3">
              <summary className="min-h-[44px] cursor-pointer content-center text-sm font-bold text-forest-700">
                + Ajouter des documents
              </summary>
              <CareForm
                action={uploadDocumentsAction}
                csrfToken={csrfToken}
                hidden={{ propertyId: property.id }}
                submitLabel="Envoyer"
                resetOnSuccess
                className="mt-3 space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Type de document" name="kind" defaultValue="PLAN" required>
                    {PROPERTY_DOCUMENT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {ATTACHMENT_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </SelectField>
                  <TextField label="Titre (facultatif)" name="title" maxLength={120} />
                  <SelectField
                    label="Équipement concerné (facultatif)"
                    name="equipmentId"
                    defaultValue=""
                  >
                    <option value="">Aucun</option>
                    {activeEquipments.map((equipment) => (
                      <option key={equipment.id} value={equipment.id}>
                        {equipment.name}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Fichiers"
                    name="files"
                    type="file"
                    multiple
                    required
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    hint="JPEG, PNG, WebP ou PDF · 5 Mo maximum par fichier · 4 fichiers maximum."
                  />
                </div>
              </CareForm>
            </details>
          ) : null}
        </CardBody>
      </Card>

      {/* Historique */}
      <Card as="section">
        <CardHeader
          title={<span id="historique">Historique des interventions</span>}
          description="Demandes, devis acceptés et rapports de ce logement."
        />
        <CardBody className="space-y-4">
          {property.requests.length > 0 ? (
            <form
              method="get"
              action={`/ker-care/mon-espace/maisons/${property.id}#historique`}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
            >
              <TextField label="Du" name="du" type="date" defaultValue={filters.du ?? ''} />
              <TextField label="Au" name="au" type="date" defaultValue={filters.au ?? ''} />
              <SelectField
                label="Catégorie"
                name="categorie"
                defaultValue={filters.categorie ?? ''}
              >
                <option value="">Toutes</option>
                {historyCategories.map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Équipement"
                name="equipement"
                defaultValue={filters.equipement ?? ''}
              >
                <option value="">Tous</option>
                {property.equipments.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {equipment.name}
                  </option>
                ))}
              </SelectField>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="min-h-[48px] flex-1 rounded-xl bg-forest-600 px-4 text-sm font-semibold text-white hover:bg-forest-500"
                >
                  Filtrer
                </button>
                {filtered ? (
                  <Link
                    href={`/ker-care/mon-espace/maisons/${property.id}#historique`}
                    className="inline-flex min-h-[48px] items-center rounded-xl border border-sand-300 px-3 text-sm font-semibold text-ink-soft"
                  >
                    Effacer
                  </Link>
                ) : null}
              </div>
            </form>
          ) : null}

          {history.length === 0 ? (
            <EmptyState
              title={
                filtered
                  ? 'Aucune intervention ne correspond à ces filtres'
                  : 'Aucune intervention pour ce logement'
              }
              description={
                filtered
                  ? 'Modifiez ou effacez les filtres.'
                  : 'Les interventions clôturées viendront enrichir ce carnet.'
              }
              action={
                !filtered && !archived ? (
                  <LinkButton
                    href={`/ker-care/mon-espace/demandes/nouvelle?logement=${property.id}`}
                    size="sm"
                  >
                    Demander une intervention
                  </LinkButton>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-3">
              {history.map((request) => {
                const quote = request.quotes[0];
                const report = request.reports[0];
                return (
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
                    <p className="mt-1 text-xs text-ink-muted">
                      {request.reference} · demandée le {formatDate(request.createdAt)}
                      {request.validatedAt
                        ? ` · validée le ${formatDate(request.validatedAt)}`
                        : ''}
                    </p>
                    {quote ? (
                      <p className="mt-2 text-sm text-ink-soft">
                        Devis accepté (v{quote.version}) :{' '}
                        <span className="font-semibold text-forest-700">
                          {formatXOF(quote.totalAmount)}
                        </span>
                      </p>
                    ) : null}
                    {report ? (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                        <span className="font-semibold">Rapport : </span>
                        {report.workDone}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

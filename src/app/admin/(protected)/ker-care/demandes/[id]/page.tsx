import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { RequestStatus } from '@prisma/client';
import { hasRole, requireAdmin } from '@/lib/auth/guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { getSettingInt, SETTING_KEYS } from '@/lib/settings';
import { CareError } from '@/lib/care/errors';
import { eligibleProviders, getRequestForAdmin } from '@/lib/care/services/admin';
import { ADMIN_MANUAL_TRANSITIONS } from '@/lib/care/services/requests';
import { availableTransitions } from '@/lib/care/workflow';
import { splitCommission } from '@/lib/care/quote';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  PREFERRED_SLOT_LABELS,
  PROPERTY_TYPE_LABELS,
  REQUEST_KIND_LABELS,
  REQUEST_STATUS_LABELS,
} from '@/lib/care/constants';
import { formatDate, formatDateTime, formatPercentage, formatXOF } from '@/lib/format';
import {
  adminCancelAppointmentAction,
  assignProviderAction,
  requestTransitionAction,
} from '@/app/admin/actions/care';
import { ActionForm } from '@/components/admin/ActionForm';
import { AttachmentGrid } from '@/components/care/Attachments';
import { QuoteDetails } from '@/components/care/QuoteDetails';
import { RequestStatusBadge, VerificationBadge } from '@/components/care/StatusBadge';
import { Timeline } from '@/components/care/Timeline';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert, Badge } from '@/components/ui/Feedback';

export const metadata: Metadata = { title: 'Demande Kër Care' };
export const dynamic = 'force-dynamic';

const ASSIGNABLE: RequestStatus[] = [
  'SUBMITTED',
  'SEARCHING',
  'ASSIGNED',
  'ACCEPTED',
  'QUOTE_SENT',
  'QUOTE_REFUSED',
];

function transitionLabel(to: RequestStatus, from: RequestStatus): string {
  switch (to) {
    case 'SEARCHING':
      return from === 'SUBMITTED'
        ? 'Marquer « recherche de prestataire »'
        : 'Retirer le prestataire';
    case 'EN_ROUTE':
      return 'Prestataire en route';
    case 'ARRIVED':
      return 'Prestataire arrivé';
    case 'IN_PROGRESS':
      return from === 'DISPUTED'
        ? 'Reprendre l’intervention (après contestation)'
        : 'Intervention démarrée';
    case 'CLOSED':
      return 'Clôturer la demande';
    case 'CANCELLED':
      return 'Annuler la demande';
    default:
      return REQUEST_STATUS_LABELS[to];
  }
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-ink-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default async function CareRequestAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin(`/admin/ker-care/demandes/${id}`);
  let request;
  try {
    request = await getRequestForAdmin(id);
  } catch (error) {
    if (error instanceof CareError) notFound();
    throw error;
  }
  const canOperate = hasRole(admin, 'MANAGER');
  const [csrfToken, commissionRate, providers] = await Promise.all([
    getCsrfToken(),
    getSettingInt(SETTING_KEYS.CARE_COMMISSION_RATE, 1000),
    canOperate && ASSIGNABLE.includes(request.status)
      ? eligibleProviders(request.category.slug, request.property.commune)
      : Promise.resolve([]),
  ]);

  const activeAssignment = request.assignments.find(
    (a) => a.status === 'PENDING' || a.status === 'ACCEPTED',
  );
  const candidates = providers.filter(
    (p) => p.matchesSpecialty && p.id !== activeAssignment?.providerId,
  );
  const transitions = availableTransitions(request.status, 'ADMIN').filter(
    (to) =>
      ADMIN_MANUAL_TRANSITIONS.includes(to) &&
      // Le retrait n'a de sens que si un prestataire est affecté (ou depuis « reçue »).
      (to !== 'SEARCHING' || request.status === 'SUBMITTED' || Boolean(activeAssignment)),
  );
  const timelineEvents = request.events.map((event) => ({
    ...event,
    actorName: event.actorAdmin?.name ?? event.actorAccount?.name ?? null,
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/admin/ker-care/demandes"
        className="text-sm font-semibold text-forest-600 underline"
      >
        ← Demandes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{request.reference}</h1>
          <p className="text-sm text-ink-muted">
            {request.category.name} · reçue le {formatDateTime(request.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            tone={
              request.kind === 'EMERGENCY'
                ? 'danger'
                : request.kind === 'QUICK_REPAIR'
                  ? 'warning'
                  : 'neutral'
            }
          >
            {REQUEST_KIND_LABELS[request.kind]}
          </Badge>
          <RequestStatusBadge status={request.status} />
        </div>
      </div>

      {request.kind === 'EMERGENCY' ? (
        <Alert tone="danger" title="Danger signalé">
          Le client a été invité à se mettre en sécurité et à appeler les secours. Kër Care n’est
          pas un service de secours : vérifiez sa situation avant toute affectation.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card as="section" className="lg:col-span-2">
          <CardHeader title="Demande" />
          <CardBody className="space-y-4">
            <p className="whitespace-pre-line text-sm">{request.description}</p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Info
                label="Date souhaitée"
                value={request.preferredDate ? formatDate(request.preferredDate) : null}
              />
              <Info
                label="Créneau"
                value={
                  request.preferredSlot
                    ? (PREFERRED_SLOT_LABELS[request.preferredSlot] ?? request.preferredSlot)
                    : null
                }
              />
              <Info
                label="Première réponse"
                value={
                  request.firstResponseAt ? formatDateTime(request.firstResponseAt) : 'En attente'
                }
              />
              <Info
                label="Équipement"
                value={
                  request.equipment
                    ? `${request.equipment.name}${request.equipment.type ? ` (${request.equipment.type.name})` : ''}`
                    : null
                }
              />
              <Info
                label="Validée le"
                value={request.validatedAt ? formatDateTime(request.validatedAt) : null}
              />
              <Info
                label="Clôturée le"
                value={request.closedAt ? formatDateTime(request.closedAt) : null}
              />
            </dl>
            <AttachmentGrid
              attachments={request.attachments.filter((a) => !a.reportId)}
              emptyLabel="Aucune photo jointe."
            />
          </CardBody>
        </Card>

        <Card as="section">
          <CardHeader title="Client et logement" />
          <CardBody>
            <dl className="space-y-3">
              <Info label="Client" value={request.requester.name} />
              <Info
                label="Téléphone"
                value={
                  <a className="underline" href={`tel:${request.requester.phone}`}>
                    {request.requester.phone}
                  </a>
                }
              />
              <Info label="Email" value={request.requester.email} />
              <Info
                label="Logement"
                value={`${request.property.name} (${PROPERTY_TYPE_LABELS[request.property.type]})`}
              />
              <Info
                label="Localisation"
                value={[request.property.quartier, request.property.commune]
                  .filter(Boolean)
                  .join(', ')}
              />
              <Info label="Repère" value={request.property.landmark} />
              <Info label="Adresse" value={request.property.address} />
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card as="section">
        <CardHeader
          title="Prestataire"
          description="Seuls les prestataires vérifiés couvrant la catégorie peuvent être affectés."
        />
        <CardBody className="space-y-4">
          {request.assignments.length ? (
            <ul className="divide-y divide-sand-200 text-sm">
              {request.assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <span className="font-semibold">
                      {assignment.provider.businessName || assignment.provider.account.name}
                    </span>{' '}
                    <span className="text-ink-muted">· {assignment.provider.account.phone}</span>
                  </span>
                  <span className="text-ink-muted">
                    Affecté le {formatDateTime(assignment.assignedAt)}
                    {assignment.assignedBy ? ` par ${assignment.assignedBy.name}` : ''}
                    {assignment.reason ? ` · ${assignment.reason}` : ''}
                  </span>
                  <Badge
                    tone={
                      assignment.status === 'ACCEPTED'
                        ? 'success'
                        : assignment.status === 'PENDING'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucun prestataire affecté pour le moment.</p>
          )}

          {canOperate && ASSIGNABLE.includes(request.status) ? (
            candidates.length ? (
              <ActionForm
                action={assignProviderAction}
                csrfToken={csrfToken}
                hidden={{ requestId: request.id }}
                submitLabel={activeAssignment ? 'Réaffecter' : 'Affecter'}
                variant="primary"
                confirmMessage={
                  activeAssignment
                    ? 'Réaffecter la demande ? Le prestataire actuel sera retiré, ses devis en attente et rendez-vous annulés.'
                    : undefined
                }
              >
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-forest-700">
                    {activeAssignment ? 'Réaffecter à' : 'Affecter à'}
                  </legend>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {candidates.map((provider, index) => (
                      <li key={provider.id}>
                        <label className="flex cursor-pointer gap-3 rounded-xl border border-sand-200 p-3 hover:border-forest-300">
                          <input
                            type="radio"
                            name="providerId"
                            value={provider.id}
                            defaultChecked={index === 0}
                            className="mt-1 accent-forest-600"
                          />
                          <span className="text-sm">
                            <span className="block font-semibold">
                              {provider.businessName || provider.account.name}
                            </span>
                            <span className="block text-ink-muted">{provider.account.phone}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              <Badge tone={provider.matchesZone ? 'success' : 'warning'}>
                                {provider.matchesZone ? 'Zone couverte' : 'Hors zone déclarée'}
                              </Badge>
                              <Badge tone="neutral">
                                {provider.activeMissions} mission(s) en cours
                              </Badge>
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              </ActionForm>
            ) : (
              <Alert tone="warning">
                Aucun prestataire vérifié ne couvre la catégorie « {request.category.name} ».{' '}
                <Link href="/admin/ker-care/prestataires" className="font-semibold underline">
                  Gérer les prestataires
                </Link>
              </Alert>
            )
          ) : null}
        </CardBody>
      </Card>

      {canOperate && transitions.length ? (
        <Card as="section">
          <CardHeader
            title="Actions sur la demande"
            description="Chaque action est horodatée et journalisée avec son motif."
          />
          <CardBody className="grid gap-4 md:grid-cols-2">
            {transitions.map((to) => (
              <ActionForm
                key={to}
                action={requestTransitionAction}
                csrfToken={csrfToken}
                hidden={{ requestId: request.id, to }}
                submitLabel={transitionLabel(to, request.status)}
                variant={to === 'CANCELLED' ? 'danger' : 'secondary'}
                size="sm"
                confirmMessage={
                  to === 'CANCELLED' || to === 'CLOSED'
                    ? `${transitionLabel(to, request.status)} ?`
                    : undefined
                }
                className="rounded-xl border border-sand-200 p-3"
              >
                <label className="block text-sm">
                  <span className="font-semibold text-forest-700">
                    Motif
                    {to === 'CANCELLED' || to === 'SEARCHING' ? ' (obligatoire)' : ' (facultatif)'}
                  </span>
                  <textarea
                    name="reason"
                    rows={2}
                    maxLength={1000}
                    required={to === 'CANCELLED' || to === 'SEARCHING'}
                    className="mt-1 w-full rounded-xl border border-sand-300 p-2 text-sm"
                  />
                </label>
              </ActionForm>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card as="section">
        <CardHeader
          title="Devis"
          description={`Répartition indicative avec une commission de ${formatPercentage(commissionRate)} — aucun paiement n’est collecté par la plateforme.`}
        />
        <CardBody>
          {request.quotes.length ? (
            <ul className="space-y-4">
              {request.quotes.map((quote) => {
                const split = splitCommission(quote.totalAmount, commissionRate);
                return (
                  <li
                    key={quote.id}
                    className="grid gap-4 rounded-xl border border-sand-200 p-4 lg:grid-cols-[minmax(0,1fr)_260px]"
                  >
                    <QuoteDetails quote={quote} />
                    <dl className="h-fit space-y-1 rounded-xl bg-sand-50 p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase text-ink-muted">
                        Répartition indicative
                      </p>
                      <div className="flex justify-between gap-2">
                        <dt>Montant client</dt>
                        <dd>{formatXOF(quote.totalAmount)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Commission Kerplus</dt>
                        <dd>{formatXOF(split.commission)}</dd>
                      </div>
                      <div className="flex justify-between gap-2 font-semibold">
                        <dt>Part prestataire</dt>
                        <dd>{formatXOF(split.providerShare)}</dd>
                      </div>
                      <p className="pt-1 text-xs text-ink-muted">
                        Hors frais de paiement et remboursements.
                      </p>
                    </dl>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucun devis.</p>
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader title="Rendez-vous" description="Heure de Dakar (GMT)." />
        <CardBody>
          {request.appointments.length ? (
            <ul className="space-y-3">
              {request.appointments.map((appointment) => (
                <li key={appointment.id} className="rounded-xl border border-sand-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{' '}
                      {formatDateTime(appointment.startsAt)} → {formatDateTime(appointment.endsAt)}
                    </span>
                    <Badge
                      tone={
                        appointment.status === 'CONFIRMED'
                          ? 'success'
                          : appointment.status === 'PROPOSED'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {APPOINTMENT_STATUS_LABELS[appointment.status]}
                    </Badge>
                  </div>
                  {appointment.fee > 0 ? (
                    <p className="text-ink-soft">Frais annoncés : {formatXOF(appointment.fee)}</p>
                  ) : null}
                  {appointment.cancelReason ? (
                    <p className="text-ink-muted">Motif : {appointment.cancelReason}</p>
                  ) : null}
                  {canOperate &&
                  (appointment.status === 'PROPOSED' || appointment.status === 'CONFIRMED') ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold text-red-700">
                        Annuler ce rendez-vous
                      </summary>
                      <ActionForm
                        action={adminCancelAppointmentAction}
                        csrfToken={csrfToken}
                        hidden={{ appointmentId: appointment.id }}
                        submitLabel="Confirmer l’annulation"
                        variant="danger"
                        size="sm"
                      >
                        <label className="mt-2 block">
                          <span className="font-semibold">Motif</span>
                          <textarea
                            name="reason"
                            required
                            rows={2}
                            maxLength={500}
                            className="mt-1 w-full rounded-xl border border-sand-300 p-2"
                          />
                        </label>
                      </ActionForm>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">Aucun rendez-vous.</p>
          )}
        </CardBody>
      </Card>

      {request.reports.length ? (
        <Card as="section">
          <CardHeader title="Rapports d’intervention" />
          <CardBody className="space-y-4">
            {request.reports.map((report) => (
              <article key={report.id} className="space-y-2 rounded-xl border border-sand-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">
                    Révision {report.revision} · {formatDateTime(report.submittedAt)}
                  </h3>
                  <Badge
                    tone={
                      report.clientDecision === 'CONFIRMED'
                        ? 'success'
                        : report.clientDecision === 'CONTESTED'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {report.clientDecision === 'CONFIRMED'
                      ? 'Validé par le client'
                      : report.clientDecision === 'CONTESTED'
                        ? 'Contesté'
                        : 'En attente du client'}
                  </Badge>
                </div>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <Info label="Diagnostic" value={report.diagnostic} />
                  <Info label="Travaux" value={report.workDone} />
                  <Info label="Pièces" value={report.partsUsed} />
                  <Info label="Recommandations" value={report.recommendations} />
                  <Info
                    label="Durée"
                    value={report.durationMinutes ? `${report.durationMinutes} min` : null}
                  />
                  <Info
                    label="Coût approuvé"
                    value={report.approvedCost !== null ? formatXOF(report.approvedCost) : null}
                  />
                  <Info
                    label="Prochain entretien"
                    value={report.nextMaintenanceAt ? formatDate(report.nextMaintenanceAt) : null}
                  />
                  <Info label="Commentaire client" value={report.clientComment} />
                </dl>
                <AttachmentGrid attachments={report.attachments} emptyLabel="Aucune photo." />
              </article>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {request.review ? (
        <Card as="section">
          <CardHeader title="Avis du client" />
          <CardBody className="text-sm">
            <p className="text-lg font-extrabold text-forest-700">{request.review.rating} / 5</p>
            <p className="text-ink-muted">
              {[
                request.review.quality ? `Qualité ${request.review.quality}/5` : null,
                request.review.punctuality ? `Ponctualité ${request.review.punctuality}/5` : null,
                request.review.price ? `Prix ${request.review.price}/5` : null,
                request.review.behaviour ? `Comportement ${request.review.behaviour}/5` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {request.review.comment ? <p className="mt-1">{request.review.comment}</p> : null}
          </CardBody>
        </Card>
      ) : null}

      <Card as="section">
        <CardHeader title="Historique" />
        <CardBody>
          <Timeline events={timelineEvents} />
        </CardBody>
      </Card>

      {activeAssignment ? (
        <p className="text-xs text-ink-muted">
          Vérification du prestataire actuel :{' '}
          <VerificationBadge status={activeAssignment.provider.verificationStatus} />
        </p>
      ) : null}
    </div>
  );
}

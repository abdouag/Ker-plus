import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireClientPage } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { getSettingString, SETTING_KEYS } from '@/lib/settings';
import { getClientRequest } from '@/lib/care/services/requests';
import { CareError } from '@/lib/care/errors';
import { availableTransitions } from '@/lib/care/workflow';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  PREFERRED_SLOT_LABELS,
  PROPERTY_TYPE_LABELS,
  REQUEST_KIND_LABELS,
  REQUEST_NEXT_STEP_CLIENT,
} from '@/lib/care/constants';
import { formatDate, formatDateTime, formatXOF } from '@/lib/format';
import { requestDecisionAction, reviewAction } from '@/app/ker-care/actions/client';
import { CareForm } from '@/components/care/CareForm';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { Timeline } from '@/components/care/Timeline';
import { QuoteDetails } from '@/components/care/QuoteDetails';
import { AttachmentGrid } from '@/components/care/Attachments';
import { RatingField } from '@/components/care/requests/RatingField';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { TextAreaField } from '@/components/ui/Field';
import { Alert, Badge } from '@/components/ui/Feedback';
import { LinkButton } from '@/components/ui/Button';
import { IconShield } from '@/components/ui/icons';

export const metadata: Metadata = {
  title: 'Suivi de ma demande — Kër Care',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function formatTimeRange(startsAt: Date, endsAt: Date): string {
  const end = new Intl.DateTimeFormat('fr-FR', {
    timeStyle: 'short',
    timeZone: 'Africa/Dakar',
  }).format(endsAt);
  return `${formatDateTime(startsAt)} – ${end}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}

export default async function ClientRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const account = await requireClientPage(`/ker-care/mon-espace/demandes/${reference}`);
  const query = await searchParams;

  let request: Awaited<ReturnType<typeof getClientRequest>>;
  try {
    request = await getClientRequest(account.id, reference);
  } catch (error) {
    if (error instanceof CareError && error.status === 404) notFound();
    throw error;
  }

  const [csrfToken, cancellationTerms] = await Promise.all([
    getCsrfToken(),
    getSettingString(SETTING_KEYS.CARE_CANCELLATION_TERMS),
  ]);

  const status = request.status;
  const canCancel = availableTransitions(status, 'CLIENT').includes('CANCELLED');
  const pendingQuotes = request.quotes.filter((quote) => quote.status === 'SENT');
  const hasAcceptedQuote = request.quotes.some((quote) => quote.status === 'ACCEPTED');
  const [latestReport, ...olderReports] = request.reports;
  const reviewable = (status === 'VALIDATED' || status === 'CLOSED') && !request.review;
  const decision = { reference: request.reference };

  return (
    <div className="space-y-6">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link
          href="/ker-care/mon-espace/demandes"
          className="font-semibold text-forest-600 hover:underline"
        >
          ← Mes interventions
        </Link>
      </nav>

      {query.envoyee === '1' ? (
        <Alert tone="success" title="Demande envoyée" role="status">
          Votre demande {request.reference} a bien été enregistrée. Kerplus recherche un prestataire
          vérifié ; vous suivez chaque étape sur cette page.
        </Alert>
      ) : null}

      {/* En-tête : statut et prochaine étape */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Demande {request.reference}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-forest-700">
                {request.category.name}
                {request.equipment ? ` — ${request.equipment.name}` : ''}
              </h1>
            </div>
            <RequestStatusBadge status={status} />
          </div>
          <Alert tone={status === 'DISPUTED' ? 'warning' : 'info'} role="status">
            <span className="font-semibold">Prochaine étape : </span>
            {REQUEST_NEXT_STEP_CLIENT[status]}
          </Alert>
          {pendingQuotes.length > 0 ? (
            <Alert tone="warning">
              {pendingQuotes.length === 1
                ? `Le devis v${pendingQuotes[0].version} attend votre décision (section « Devis » ci-dessous).`
                : 'Des devis attendent votre décision.'}
            </Alert>
          ) : null}
          {request.kind === 'EMERGENCY' ? (
            <Alert tone="danger">
              Signalée comme danger immédiat. Kër Care n’est pas un service de secours : en cas de
              danger, appelez les secours compétents.
            </Alert>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* Devis à valider en priorité */}
          {request.quotes.length > 0 ? (
            <Card as="section">
              <CardHeader
                title="Devis"
                description={
                  hasAcceptedQuote
                    ? 'Un devis accepté n’est jamais modifié : tout supplément fait l’objet d’une nouvelle version à approuver. Les versions précédentes restent consultables.'
                    : 'Acceptez ou refusez la version proposée. Les versions précédentes restent consultables.'
                }
              />
              <CardBody className="space-y-6">
                {request.quotes.map((quote, index) => (
                  <div
                    key={quote.id}
                    className={index > 0 ? 'border-t border-sand-200 pt-6' : undefined}
                  >
                    <QuoteDetails quote={quote} />
                    {quote.status === 'SENT' ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <CareForm
                          action={requestDecisionAction}
                          csrfToken={csrfToken}
                          hidden={{ ...decision, operation: 'accept-quote', quoteId: quote.id }}
                          submitLabel={`Accepter le devis (${formatXOF(quote.totalAmount)})`}
                          confirmMessage={`Accepter le devis v${quote.version} pour un total de ${formatXOF(quote.totalAmount)} ?`}
                          fullWidthSubmit
                        />
                        <CareForm
                          action={requestDecisionAction}
                          csrfToken={csrfToken}
                          hidden={{ ...decision, operation: 'refuse-quote', quoteId: quote.id }}
                          submitLabel="Refuser ce devis"
                          variant="ghost"
                          confirmMessage="Refuser ce devis ?"
                          fullWidthSubmit
                        >
                          <TextAreaField
                            label="Motif du refus (facultatif)"
                            name="reason"
                            rows={2}
                            maxLength={1000}
                            className="min-h-[70px]"
                          />
                        </CareForm>
                      </div>
                    ) : null}
                  </div>
                ))}
                <p className="text-xs text-ink-muted">
                  Le règlement en ligne n’est pas encore disponible : les modalités de paiement vous
                  sont communiquées par Kerplus. Aucun paiement n’est demandé sur cette page.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {/* Rendez-vous */}
          {request.appointments.length > 0 ? (
            <Card as="section">
              <CardHeader title="Rendez-vous" description="Horaires affichés à l’heure de Dakar." />
              <CardBody className="space-y-4">
                {request.appointments.map((appointment) => {
                  const open =
                    appointment.status === 'PROPOSED' || appointment.status === 'CONFIRMED';
                  return (
                    <div key={appointment.id} className="rounded-xl border border-sand-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-forest-700">
                          {APPOINTMENT_TYPE_LABELS[appointment.type]}
                        </p>
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
                      <p className="mt-1 text-sm">
                        {formatTimeRange(appointment.startsAt, appointment.endsAt)} (heure de Dakar)
                      </p>
                      {appointment.type === 'DIAGNOSTIC' ? (
                        <p className="mt-1 text-sm font-semibold text-ember-800">
                          Frais de diagnostic / déplacement :{' '}
                          {appointment.fee > 0 ? formatXOF(appointment.fee) : 'aucun frais annoncé'}
                        </p>
                      ) : null}
                      {appointment.note ? (
                        <p className="mt-1 text-sm text-ink-soft">{appointment.note}</p>
                      ) : null}
                      {appointment.cancelReason ? (
                        <p className="mt-1 text-sm text-ink-muted">
                          Motif : {appointment.cancelReason}
                        </p>
                      ) : null}

                      {open ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {appointment.status === 'PROPOSED' ? (
                            <CareForm
                              action={requestDecisionAction}
                              csrfToken={csrfToken}
                              hidden={{
                                ...decision,
                                operation: 'confirm-appointment',
                                appointmentId: appointment.id,
                              }}
                              submitLabel="Confirmer ce créneau"
                              confirmMessage={
                                appointment.type === 'DIAGNOSTIC' && appointment.fee > 0
                                  ? `Confirmer la visite de diagnostic ? Des frais de ${formatXOF(appointment.fee)} s’appliquent.`
                                  : 'Confirmer ce rendez-vous ?'
                              }
                              fullWidthSubmit
                            />
                          ) : null}
                          <CareForm
                            action={requestDecisionAction}
                            csrfToken={csrfToken}
                            hidden={{
                              ...decision,
                              operation: 'cancel-appointment',
                              appointmentId: appointment.id,
                            }}
                            submitLabel="Annuler / reporter"
                            variant="ghost"
                            confirmMessage="Annuler ce créneau ? Un nouveau créneau pourra vous être proposé."
                            fullWidthSubmit
                          >
                            <TextAreaField
                              label="Motif (obligatoire)"
                              name="reason"
                              required
                              rows={2}
                              maxLength={500}
                              className="min-h-[70px]"
                            />
                          </CareForm>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {cancellationTerms ? (
                  <p className="text-xs text-ink-muted">
                    <span className="font-semibold">Conditions d’annulation : </span>
                    {cancellationTerms}
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {/* Rapport d'intervention */}
          {latestReport ? (
            <Card as="section">
              <CardHeader
                title="Rapport d’intervention"
                description={`Déposé le ${formatDateTime(latestReport.submittedAt)}${
                  latestReport.revision > 1 ? ` · révision ${latestReport.revision}` : ''
                }`}
              />
              <CardBody className="space-y-4">
                <ReportBody report={latestReport} />

                {status === 'WORK_DONE' ? (
                  <div className="grid gap-4 border-t border-sand-200 pt-4 sm:grid-cols-2">
                    <CareForm
                      action={requestDecisionAction}
                      csrfToken={csrfToken}
                      hidden={{ ...decision, operation: 'validate' }}
                      submitLabel="Valider l’intervention"
                      confirmMessage="Confirmez-vous que l’intervention a été réalisée comme décrit ?"
                      fullWidthSubmit
                    >
                      <TextAreaField
                        label="Commentaire (facultatif)"
                        name="reason"
                        rows={2}
                        maxLength={1000}
                        className="min-h-[70px]"
                      />
                    </CareForm>
                    <CareForm
                      action={requestDecisionAction}
                      csrfToken={csrfToken}
                      hidden={{ ...decision, operation: 'contest' }}
                      submitLabel="Contester"
                      variant="ghost"
                      confirmMessage="Transmettre votre contestation à Kerplus ?"
                      fullWidthSubmit
                    >
                      <TextAreaField
                        label="Motif de la contestation (obligatoire)"
                        name="reason"
                        required
                        minLength={5}
                        rows={2}
                        maxLength={1000}
                        className="min-h-[70px]"
                      />
                    </CareForm>
                  </div>
                ) : null}

                {olderReports.length > 0 ? (
                  <details className="rounded-xl border border-sand-200 p-3">
                    <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-semibold text-forest-700">
                      Révisions précédentes ({olderReports.length})
                    </summary>
                    <div className="mt-3 space-y-6">
                      {olderReports.map((report) => (
                        <div key={report.id} className="border-t border-sand-200 pt-3">
                          <p className="mb-2 text-xs text-ink-muted">
                            Révision {report.revision} · {formatDateTime(report.submittedAt)}
                          </p>
                          <ReportBody report={report} />
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {/* Avis */}
          {request.review ? (
            <Card as="section">
              <CardHeader title="Votre avis" />
              <CardBody className="space-y-1 text-sm">
                <p className="text-base font-bold text-forest-700">
                  Note globale : {request.review.rating}/5
                </p>
                <ul className="text-ink-soft">
                  {request.review.quality ? <li>Qualité : {request.review.quality}/5</li> : null}
                  {request.review.punctuality ? (
                    <li>Ponctualité : {request.review.punctuality}/5</li>
                  ) : null}
                  {request.review.price ? <li>Prix : {request.review.price}/5</li> : null}
                  {request.review.behaviour ? (
                    <li>Comportement : {request.review.behaviour}/5</li>
                  ) : null}
                </ul>
                {request.review.comment ? (
                  <p className="pt-1">« {request.review.comment} »</p>
                ) : null}
              </CardBody>
            </Card>
          ) : reviewable ? (
            <Card as="section">
              <CardHeader
                title="Donnez votre avis"
                description="Un seul avis par intervention. Il aide Kerplus à suivre la qualité des prestataires."
              />
              <CardBody>
                <CareForm
                  action={reviewAction}
                  csrfToken={csrfToken}
                  hidden={decision}
                  submitLabel="Publier mon avis"
                  className="space-y-4"
                >
                  <RatingField name="rating" legend="Note globale" required />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <RatingField name="quality" legend="Qualité du travail" />
                    <RatingField name="punctuality" legend="Ponctualité" />
                    <RatingField name="price" legend="Prix" />
                    <RatingField name="behaviour" legend="Comportement" />
                  </div>
                  <TextAreaField
                    label="Commentaire (facultatif)"
                    name="comment"
                    rows={3}
                    maxLength={1500}
                  />
                </CareForm>
              </CardBody>
            </Card>
          ) : null}

          {/* Description et photos */}
          <Card as="section">
            <CardHeader title="Votre demande" />
            <CardBody className="space-y-4">
              <p className="whitespace-pre-line text-sm text-ink-soft">{request.description}</p>
              <AttachmentGrid attachments={request.attachments} emptyLabel="Aucune photo jointe." />
            </CardBody>
          </Card>

          <Card as="section">
            <CardHeader
              title="Historique"
              description="Chaque étape est horodatée (heure de Dakar)."
            />
            <CardBody>
              <Timeline events={request.events} />
            </CardBody>
          </Card>
        </div>

        {/* Colonne latérale */}
        <aside className="space-y-6">
          <Card>
            <CardHeader title="Prestataire" />
            <CardBody className="space-y-2 text-sm">
              {request.currentProvider ? (
                <>
                  <p className="text-base font-bold text-forest-700">
                    {request.currentProvider.businessName || request.currentProvider.name}
                  </p>
                  {request.currentProvider.businessName ? (
                    <p className="text-ink-soft">{request.currentProvider.name}</p>
                  ) : null}
                  {request.currentProvider.verified ? (
                    <Badge tone="success">
                      <IconShield className="mr-1 h-3.5 w-3.5" />
                      Vérifié par Kerplus
                    </Badge>
                  ) : null}
                  {request.currentProvider.phone ? (
                    <p>
                      <a
                        href={`tel:${request.currentProvider.phone}`}
                        className="inline-flex min-h-[44px] items-center font-semibold text-forest-600 underline"
                      >
                        {request.currentProvider.phone}
                      </a>
                    </p>
                  ) : (
                    <p className="text-ink-muted">
                      Ses coordonnées s’affichent dès qu’il a accepté la mission.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-ink-muted">
                  Aucun prestataire affecté pour le moment. Kerplus vous propose un professionnel
                  vérifié.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Détails" />
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-ink-muted">Logement</dt>
                  <dd className="font-semibold">
                    <Link
                      href={`/ker-care/mon-espace/maisons/${request.property.id}`}
                      className="text-forest-600 hover:underline"
                    >
                      {request.property.name}
                    </Link>{' '}
                    · {PROPERTY_TYPE_LABELS[request.property.type]}, {request.property.commune}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Urgence ressentie</dt>
                  <dd>{REQUEST_KIND_LABELS[request.kind]}</dd>
                </div>
                {request.equipment ? (
                  <div>
                    <dt className="text-ink-muted">Équipement</dt>
                    <dd>{request.equipment.name}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-ink-muted">Disponibilité souhaitée</dt>
                  <dd>
                    {request.preferredDate
                      ? formatDate(request.preferredDate)
                      : 'Date non précisée'}
                    {request.preferredSlot
                      ? ` · ${PREFERRED_SLOT_LABELS[request.preferredSlot] ?? request.preferredSlot}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Envoyée le</dt>
                  <dd>{formatDateTime(request.createdAt)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {status === 'VALIDATED' || status === 'CLOSED' ? (
            <Card>
              <CardBody className="space-y-3 text-sm">
                <p className="font-semibold text-forest-700">
                  Des travaux plus importants à prévoir ?
                </p>
                <p className="text-ink-soft">
                  Kerplus vous accompagne aussi pour vos projets de rénovation.
                </p>
                <LinkButton
                  href={`/ker-care/mon-espace/maisons/${request.property.id}/renovation`}
                  variant="ghost"
                  size="sm"
                  fullWidth
                >
                  Créer un projet de rénovation
                </LinkButton>
              </CardBody>
            </Card>
          ) : null}

          {canCancel ? (
            <Card>
              <CardHeader title="Annuler la demande" />
              <CardBody>
                <CareForm
                  action={requestDecisionAction}
                  csrfToken={csrfToken}
                  hidden={{ ...decision, operation: 'cancel' }}
                  submitLabel="Annuler la demande"
                  variant="danger"
                  size="sm"
                  confirmMessage="Annuler définitivement cette demande ?"
                  fullWidthSubmit
                >
                  <TextAreaField
                    label="Motif (facultatif)"
                    name="reason"
                    rows={2}
                    maxLength={1000}
                    className="min-h-[70px]"
                  />
                </CareForm>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ReportBody({
  report,
}: {
  report: Awaited<ReturnType<typeof getClientRequest>>['reports'][number];
}) {
  const before = report.attachments.filter((file) => file.kind === 'PHOTO_BEFORE');
  const after = report.attachments.filter((file) => file.kind !== 'PHOTO_BEFORE');
  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-3">
        <div>
          <dt className="font-semibold text-forest-700">Diagnostic</dt>
          <dd className="whitespace-pre-line text-ink-soft">{report.diagnostic}</dd>
        </div>
        <div>
          <dt className="font-semibold text-forest-700">Travaux effectués</dt>
          <dd className="whitespace-pre-line text-ink-soft">{report.workDone}</dd>
        </div>
        {report.partsUsed ? (
          <div>
            <dt className="font-semibold text-forest-700">Pièces utilisées</dt>
            <dd className="whitespace-pre-line text-ink-soft">{report.partsUsed}</dd>
          </div>
        ) : null}
        {report.recommendations ? (
          <div>
            <dt className="font-semibold text-forest-700">Recommandations</dt>
            <dd className="whitespace-pre-line text-ink-soft">{report.recommendations}</dd>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {report.durationMinutes ? (
            <div>
              <dt className="text-ink-muted">Durée</dt>
              <dd className="font-semibold">{formatDuration(report.durationMinutes)}</dd>
            </div>
          ) : null}
          {report.approvedCost !== null ? (
            <div>
              <dt className="text-ink-muted">Coût approuvé (devis)</dt>
              <dd className="font-semibold">{formatXOF(report.approvedCost)}</dd>
            </div>
          ) : null}
          {report.nextMaintenanceAt ? (
            <div>
              <dt className="text-ink-muted">Prochain entretien conseillé</dt>
              <dd className="font-semibold">{formatDate(report.nextMaintenanceAt)}</dd>
            </div>
          ) : null}
        </div>
        {report.clientDecision !== 'PENDING' ? (
          <div>
            <dt className="text-ink-muted">Votre décision</dt>
            <dd>
              {report.clientDecision === 'CONFIRMED' ? 'Validé' : 'Contesté'}
              {report.clientComment ? ` — ${report.clientComment}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>
      {before.length > 0 ? (
        <div>
          <p className="mb-2 font-semibold text-forest-700">Photos avant</p>
          <AttachmentGrid attachments={before} />
        </div>
      ) : null}
      {after.length > 0 ? (
        <div>
          <p className="mb-2 font-semibold text-forest-700">Photos après</p>
          <AttachmentGrid attachments={after} />
        </div>
      ) : null}
    </div>
  );
}

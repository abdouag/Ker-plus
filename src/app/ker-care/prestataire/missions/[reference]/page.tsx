import { Disclosure } from '@/components/care/Disclosure';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { RequestStatus } from '@prisma/client';
import { requireProviderPage } from '@/lib/auth/account-guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { CareError } from '@/lib/care/errors';
import { defaultQuoteValidityDays, getProviderMission } from '@/lib/care/services/requests';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  PREFERRED_SLOT_LABELS,
  PROPERTY_TYPE_LABELS,
  REQUEST_KIND_LABELS,
} from '@/lib/care/constants';
import { formatDate, formatDateISO, formatDateTime, formatXOF } from '@/lib/format';
import {
  missionProgressAction,
  proposeAppointmentAction,
  respondMissionAction,
  submitReportAction,
} from '@/app/ker-care/actions/provider';
import { CareForm } from '@/components/care/CareForm';
import { QuoteForm } from '@/components/care/provider/QuoteForm';
import { QuoteDetails } from '@/components/care/QuoteDetails';
import { AttachmentGrid } from '@/components/care/Attachments';
import { RequestStatusBadge } from '@/components/care/StatusBadge';
import { Timeline } from '@/components/care/Timeline';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert, Badge } from '@/components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';

export const metadata: Metadata = { title: 'Mission' };
export const dynamic = 'force-dynamic';

const QUOTE_ALLOWED: RequestStatus[] = [
  'ACCEPTED',
  'QUOTE_SENT',
  'QUOTE_REFUSED',
  'QUOTE_ACCEPTED',
  'SCHEDULED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
];
const DIAGNOSTIC_ALLOWED: RequestStatus[] = ['ACCEPTED', 'QUOTE_SENT', 'QUOTE_REFUSED'];

const PROVIDER_NEXT_STEP: Partial<Record<RequestStatus, string>> = {
  ACCEPTED: 'Proposez un devis, ou une visite de diagnostic si elle est nécessaire.',
  QUOTE_SENT: 'Le client doit accepter ou refuser votre devis.',
  QUOTE_REFUSED: 'Le devis a été refusé : vous pouvez proposer une version révisée.',
  QUOTE_ACCEPTED: 'Proposez un créneau d’intervention au client.',
  SCHEDULED: 'Rendez-vous confirmé. Indiquez votre arrivée le jour de l’intervention.',
  EN_ROUTE: 'Indiquez votre arrivée sur place.',
  ARRIVED: 'Démarrez l’intervention.',
  IN_PROGRESS: 'Une fois les travaux terminés, déposez le rapport d’intervention.',
  WORK_DONE: 'Le client doit valider ou contester l’intervention.',
  VALIDATED: 'Intervention validée par le client.',
  DISPUTED: 'Le client a contesté l’intervention : Kerplus examine la situation.',
  CLOSED: 'Mission clôturée.',
  CANCELLED: 'Cette demande a été annulée.',
};

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function MissionPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const account = await requireProviderPage(`/ker-care/prestataire/missions/${reference}`);
  let mission;
  try {
    mission = await getProviderMission(account.providerProfile.id, reference);
  } catch (error) {
    if (error instanceof CareError) notFound();
    throw error;
  }
  const [csrfToken, validityDays] = await Promise.all([getCsrfToken(), defaultQuoteValidityDays()]);

  const { status } = mission;
  const accepted = mission.accepted;
  const hasAcceptedQuote = mission.quotes.some((quote) => quote.status === 'ACCEPTED');
  const canPropose =
    accepted && (DIAGNOSTIC_ALLOWED.includes(status) || status === 'QUOTE_ACCEPTED');
  const today = formatDateISO(new Date());
  const tomorrow = formatDateISO(new Date(Date.now() + 24 * 3600 * 1000));

  return (
    <div className="space-y-5">
      <Link
        href="/ker-care/prestataire"
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest-600 underline"
      >
        ← Retour au tableau de bord
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {mission.reference}
          </p>
          <h1 className="text-2xl font-extrabold text-forest-700">{mission.category.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <RequestStatusBadge status={status} />
            <Badge
              tone={
                mission.kind === 'EMERGENCY'
                  ? 'danger'
                  : mission.kind === 'QUICK_REPAIR'
                    ? 'warning'
                    : 'info'
              }
            >
              {REQUEST_KIND_LABELS[mission.kind]}
            </Badge>
          </div>
        </div>
      </div>

      {accepted && PROVIDER_NEXT_STEP[status] ? (
        <Alert tone="info" title="Prochaine étape">
          {PROVIDER_NEXT_STEP[status]}
        </Alert>
      ) : null}

      {!accepted ? (
        <Card as="section">
          <CardHeader
            title="Répondre à la mission"
            description="L’adresse précise et les coordonnées du client vous seront communiquées après acceptation."
          />
          <CardBody className="grid gap-5 md:grid-cols-2">
            <CareForm
              action={respondMissionAction}
              csrfToken={csrfToken}
              hidden={{ reference: mission.reference, decision: 'accept' }}
              submitLabel="Accepter la mission"
              fullWidthSubmit
            >
              <p className="text-sm text-ink-soft">
                En acceptant, vous vous engagez à contacter le client et à lui proposer un devis ou
                une visite de diagnostic.
              </p>
            </CareForm>
            <CareForm
              action={respondMissionAction}
              csrfToken={csrfToken}
              hidden={{ reference: mission.reference, decision: 'refuse' }}
              submitLabel="Refuser la mission"
              variant="ghost"
              fullWidthSubmit
            >
              <TextAreaField
                label="Motif du refus"
                name="reason"
                required
                maxLength={500}
                rows={2}
              />
            </CareForm>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card as="section">
          <CardHeader title="Demande" />
          <CardBody className="space-y-4">
            <p className="whitespace-pre-line text-sm text-ink">{mission.description}</p>
            <dl className="grid grid-cols-2 gap-3">
              <Info
                label="Date souhaitée"
                value={mission.preferredDate ? formatDate(mission.preferredDate) : null}
              />
              <Info
                label="Créneau souhaité"
                value={
                  mission.preferredSlot
                    ? (PREFERRED_SLOT_LABELS[mission.preferredSlot] ?? mission.preferredSlot)
                    : null
                }
              />
              <Info label="Reçue le" value={formatDateTime(mission.createdAt)} />
            </dl>
            {mission.equipment ? (
              <div className="rounded-xl bg-sand-50 p-3">
                <p className="text-sm font-semibold text-forest-700">
                  Équipement : {mission.equipment.name}
                </p>
                <p className="text-xs text-ink-muted">
                  {[mission.equipment.brand, mission.equipment.model].filter(Boolean).join(' · ') ||
                    'Marque / modèle non renseignés'}
                  {mission.equipment.installedAt
                    ? ` · installé le ${formatDate(mission.equipment.installedAt)}`
                    : ''}
                  {mission.equipment.lastServiceAt
                    ? ` · dernier entretien ${formatDate(mission.equipment.lastServiceAt)}`
                    : ''}
                </p>
              </div>
            ) : null}
            <div>
              <h3 className="mb-2 text-sm font-bold text-forest-700">Photos du client</h3>
              <AttachmentGrid attachments={mission.attachments} emptyLabel="Aucune photo jointe." />
            </div>
          </CardBody>
        </Card>

        <Card as="section">
          <CardHeader title="Logement et client" />
          <CardBody className="space-y-4">
            <dl className="grid grid-cols-2 gap-3">
              <Info label="Type" value={PROPERTY_TYPE_LABELS[mission.property.type]} />
              <Info label="Commune" value={mission.property.commune} />
              <Info label="Quartier" value={mission.property.quartier} />
              <Info
                label="Surface"
                value={mission.property.surface ? `${mission.property.surface} m²` : null}
              />
              <Info label="Niveaux" value={mission.property.levels} />
              <Info label="Repère" value={mission.property.landmark} />
              <Info label="Adresse" value={mission.property.address} />
            </dl>
            {mission.client ? (
              <div className="rounded-xl border border-forest-200 bg-forest-50 p-3">
                <p className="text-sm font-semibold text-forest-800">{mission.client.name}</p>
                <a
                  href={`tel:${mission.client.phone}`}
                  className="inline-flex min-h-[44px] items-center font-bold text-forest-600 underline"
                >
                  {mission.client.phone}
                </a>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                Coordonnées du client communiquées après acceptation.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {accepted ? (
        <Card as="section">
          <CardHeader
            title="Devis"
            description="Une version acceptée est verrouillée : tout supplément fait l’objet d’une nouvelle version à faire approuver par le client."
          />
          <CardBody className="space-y-5">
            {mission.quotes.length ? (
              <ul className="space-y-4">
                {mission.quotes.map((quote) => (
                  <li key={quote.id} className="rounded-xl border border-sand-200 p-4">
                    <QuoteDetails quote={quote} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Aucun devis envoyé.</p>
            )}
            {QUOTE_ALLOWED.includes(status) ? (
              <Disclosure
                className="rounded-xl border border-forest-200 p-4"
                defaultOpen={mission.quotes.length === 0}
                summaryClassName="min-h-[44px] cursor-pointer py-2 font-bold text-forest-700"
                summary={
                  <>
                    {hasAcceptedQuote
                      ? 'Proposer un supplément (nouvelle version)'
                      : mission.quotes.length
                        ? 'Proposer une nouvelle version'
                        : 'Établir le devis'}
                  </>
                }
              >
                <div className="mt-3">
                  <QuoteForm
                    reference={mission.reference}
                    csrfToken={csrfToken}
                    defaultValidityDays={validityDays}
                    isSupplement={hasAcceptedQuote}
                  />
                </div>
              </Disclosure>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {accepted ? (
        <Card as="section">
          <CardHeader
            title="Rendez-vous"
            description="Heures exprimées à l’heure de Dakar (GMT)."
          />
          <CardBody className="space-y-5">
            {mission.appointments.length ? (
              <ul className="space-y-3">
                {mission.appointments.map((appointment) => (
                  <li key={appointment.id} className="rounded-xl border border-sand-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-forest-700">
                        {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{' '}
                        {formatDateTime(appointment.startsAt)} →{' '}
                        {formatDateTime(appointment.endsAt)}
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
                    {appointment.fee > 0 ? (
                      <p className="text-sm text-ink-soft">
                        Frais annoncés : {formatXOF(appointment.fee)}
                      </p>
                    ) : null}
                    {appointment.note ? (
                      <p className="text-sm text-ink-soft">{appointment.note}</p>
                    ) : null}
                    {appointment.cancelReason ? (
                      <p className="text-sm text-ink-muted">Motif : {appointment.cancelReason}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-4">
                      {appointment.type === 'DIAGNOSTIC' && appointment.status === 'CONFIRMED' ? (
                        <CareForm
                          action={missionProgressAction}
                          csrfToken={csrfToken}
                          hidden={{
                            reference: mission.reference,
                            operation: 'diagnostic-done',
                            appointmentId: appointment.id,
                          }}
                          submitLabel="Diagnostic effectué"
                          variant="secondary"
                          size="sm"
                        />
                      ) : null}
                      {appointment.status === 'PROPOSED' ||
                      (appointment.status === 'CONFIRMED' &&
                        (appointment.type === 'DIAGNOSTIC' || status === 'SCHEDULED')) ? (
                        <details className="w-full sm:w-auto">
                          <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-semibold text-red-700">
                            Annuler / reporter
                          </summary>
                          <CareForm
                            action={missionProgressAction}
                            csrfToken={csrfToken}
                            hidden={{
                              reference: mission.reference,
                              operation: 'cancel-appointment',
                              appointmentId: appointment.id,
                            }}
                            submitLabel="Confirmer l’annulation"
                            variant="danger"
                            size="sm"
                            confirmMessage="Annuler ce rendez-vous ? Le client en sera informé dans son espace."
                          >
                            <TextAreaField
                              label="Motif"
                              name="reason"
                              required
                              rows={2}
                              maxLength={500}
                            />
                          </CareForm>
                        </details>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Aucun rendez-vous pour le moment.</p>
            )}

            {canPropose ? (
              <details className="rounded-xl border border-forest-200 p-4">
                <summary className="min-h-[44px] cursor-pointer py-2 font-bold text-forest-700">
                  Proposer un créneau
                </summary>
                <CareForm
                  action={proposeAppointmentAction}
                  csrfToken={csrfToken}
                  hidden={{ reference: mission.reference }}
                  submitLabel="Proposer ce créneau"
                  resetOnSuccess
                  className="mt-3"
                  fullWidthSubmit
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Type de rendez-vous"
                      name="type"
                      required
                      defaultValue={status === 'QUOTE_ACCEPTED' ? 'INTERVENTION' : 'DIAGNOSTIC'}
                    >
                      {DIAGNOSTIC_ALLOWED.includes(status) ? (
                        <option value="DIAGNOSTIC">Visite de diagnostic</option>
                      ) : null}
                      {status === 'QUOTE_ACCEPTED' ? (
                        <option value="INTERVENTION">Intervention</option>
                      ) : null}
                    </SelectField>
                    <TextField
                      label="Date"
                      name="date"
                      type="date"
                      min={today}
                      defaultValue={tomorrow}
                      required
                    />
                    <TextField
                      label="Heure de début (Dakar)"
                      name="startTime"
                      type="time"
                      defaultValue="09:00"
                      required
                    />
                    <TextField
                      label="Durée estimée (minutes)"
                      name="durationMinutes"
                      type="number"
                      min={15}
                      max={720}
                      defaultValue={120}
                      required
                    />
                    {DIAGNOSTIC_ALLOWED.includes(status) ? (
                      <TextField
                        label="Frais de diagnostic / déplacement (FCFA)"
                        name="fee"
                        inputMode="numeric"
                        hint="Affichés au client avant confirmation. Ignorés pour une intervention."
                        defaultValue="0"
                      />
                    ) : null}
                  </div>
                  <TextAreaField
                    label="Note au client"
                    name="note"
                    maxLength={500}
                    rows={2}
                    containerClassName="mt-3"
                  />
                </CareForm>
              </details>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {accepted && ['SCHEDULED', 'EN_ROUTE', 'ARRIVED'].includes(status) ? (
        <Card as="section">
          <CardHeader title="Déroulé de l’intervention" />
          <CardBody className="flex flex-wrap gap-3">
            {status === 'SCHEDULED' ? (
              <CareForm
                action={missionProgressAction}
                csrfToken={csrfToken}
                hidden={{ reference: mission.reference, operation: 'EN_ROUTE' }}
                submitLabel="Je suis en route"
                variant="ghost"
              />
            ) : null}
            {status === 'SCHEDULED' || status === 'EN_ROUTE' ? (
              <CareForm
                action={missionProgressAction}
                csrfToken={csrfToken}
                hidden={{ reference: mission.reference, operation: 'ARRIVED' }}
                submitLabel="Je suis arrivé sur place"
                variant="secondary"
              />
            ) : null}
            {status === 'ARRIVED' ? (
              <CareForm
                action={missionProgressAction}
                csrfToken={csrfToken}
                hidden={{ reference: mission.reference, operation: 'IN_PROGRESS' }}
                submitLabel="Démarrer l’intervention"
              />
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {accepted && (status === 'IN_PROGRESS' || mission.reports.length > 0) ? (
        <Card as="section">
          <CardHeader title="Rapport d’intervention" />
          <CardBody className="space-y-5">
            {mission.reports.map((report) => (
              <article key={report.id} className="space-y-2 rounded-xl border border-sand-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-forest-700">
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
                        ? 'Contesté par le client'
                        : 'En attente du client'}
                  </Badge>
                </div>
                <dl className="space-y-2 text-sm">
                  <Info label="Diagnostic" value={report.diagnostic} />
                  <Info label="Travaux effectués" value={report.workDone} />
                  <Info label="Pièces utilisées" value={report.partsUsed} />
                  <Info label="Recommandations" value={report.recommendations} />
                  <Info
                    label="Durée"
                    value={report.durationMinutes ? `${report.durationMinutes} min` : null}
                  />
                  <Info
                    label="Coût approuvé (dernier devis accepté)"
                    value={report.approvedCost !== null ? formatXOF(report.approvedCost) : null}
                  />
                  <Info
                    label="Prochain entretien proposé"
                    value={report.nextMaintenanceAt ? formatDate(report.nextMaintenanceAt) : null}
                  />
                  <Info label="Commentaire du client" value={report.clientComment} />
                </dl>
                <AttachmentGrid attachments={report.attachments} emptyLabel="Aucune photo." />
              </article>
            ))}
            {status === 'IN_PROGRESS' ? (
              <CareForm
                action={submitReportAction}
                csrfToken={csrfToken}
                hidden={{ reference: mission.reference }}
                submitLabel="Déposer le rapport et déclarer les travaux terminés"
                confirmMessage="Déposer le rapport ? Le client sera invité à valider l’intervention."
                fullWidthSubmit
              >
                <div className="space-y-3">
                  <TextAreaField label="Diagnostic" name="diagnostic" required maxLength={4000} />
                  <TextAreaField
                    label="Travaux effectués"
                    name="workDone"
                    required
                    maxLength={4000}
                  />
                  <TextAreaField label="Pièces utilisées" name="partsUsed" maxLength={2000} />
                  <TextAreaField label="Recommandations" name="recommendations" maxLength={2000} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Durée (minutes)"
                      name="durationMinutes"
                      type="number"
                      min={1}
                    />
                    <TextField
                      label="Prochain entretien proposé"
                      name="nextMaintenanceAt"
                      type="date"
                      min={today}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Photos avant"
                      name="photosBefore"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                    />
                    <TextField
                      label="Photos après"
                      name="photosAfter"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                    />
                  </div>
                  <p className="text-xs text-ink-muted">
                    4 photos maximum au total (JPEG, PNG ou WebP, 5 Mo chacune).
                  </p>
                </div>
              </CareForm>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {mission.review ? (
        <Card as="section">
          <CardHeader title="Avis du client" />
          <CardBody>
            <p className="text-lg font-extrabold text-forest-700">{mission.review.rating} / 5</p>
            {mission.review.comment ? (
              <p className="mt-1 text-sm text-ink-soft">{mission.review.comment}</p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card as="section">
        <CardHeader title="Historique" />
        <CardBody>
          <Timeline events={mission.events} />
        </CardBody>
      </Card>
    </div>
  );
}

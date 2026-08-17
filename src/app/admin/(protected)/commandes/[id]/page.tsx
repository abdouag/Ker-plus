import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert, Badge } from '@/components/ui/Feedback';
import { ActionForm } from '@/components/admin/ActionForm';
import { ReportEditor } from '@/components/admin/ReportEditor';
import {
  confirmPaymentAction,
  resendOrderEmailAction,
  updateConsultationCallAction,
  updateOrderNotesAction,
  updateOrderStatusAction,
  updatePaymentStatusAction,
} from '@/app/admin/actions/orders';
import {
  generateReportPdfAction,
  importReportPdfAction,
  markReportReadyAction,
  reissueDownloadLinkAction,
  revokeDownloadLinkAction,
  sendReportAction,
} from '@/app/admin/actions/reports';
import {
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  PAYMENT_STATUS_LABELS,
} from '@/lib/services/orders';
import { formatDate, formatDateTime, formatSurface, formatXOF } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { getActivePaymentProvider } from '@/lib/payments/registry';
import { getSettingList, getSettingString, SETTING_KEYS } from '@/lib/settings';

export const metadata: Metadata = { title: 'Détail commande' };
export const dynamic = 'force-dynamic';

const CALL_STATUS_LABELS = {
  NOT_SCHEDULED: 'Non planifié',
  PROPOSED: 'Proposé',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Réalisé',
  CANCELLED: 'Annulé',
} as const;

function toDateTimeLocal(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 16);
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const csrfToken = await getCsrfToken();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      simulation: true,
      payments: { orderBy: { createdAt: 'desc' } },
      report: { include: { items: { orderBy: { displayOrder: 'asc' } }, preparedBy: true } },
      call: true,
    },
  });

  if (!order) notFound();

  const [auditLogs, defaultExclusions, defaultAssumptions] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'Order', entityId: order.id },
          { entityType: 'Report', entityId: order.report?.id ?? '—' },
          { entityType: 'Payment', entityId: { in: order.payments.map((p) => p.id) } },
          { entityType: 'ConsultationCall', entityId: order.id },
        ],
      },
      include: { adminUser: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    getSettingList(SETTING_KEYS.EXCLUSIONS),
    getSettingString(SETTING_KEYS.ASSUMPTIONS_TEXT),
  ]);

  const payment = order.payments[0] ?? null;
  const provider = getActivePaymentProvider();
  const isPaid = payment?.status === 'PAID' && payment.verified;
  const allowedTransitions = ORDER_TRANSITIONS[order.status].filter((status) => status !== 'PAID');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/commandes" className="text-sm text-forest-600 underline">
            ← Retour aux commandes
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold">Commande {order.reference}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Créée le {formatDateTime(order.createdAt)} — montant figé : {formatXOF(order.amount)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={isPaid ? 'success' : 'warning'}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          {payment ? (
            <Badge tone={isPaid ? 'success' : 'neutral'}>
              Paiement : {PAYMENT_STATUS_LABELS[payment.status]}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        {/* min-w-0 : empêche le tableau des postes d’élargir la colonne sur mobile. */}
        <div className="min-w-0 space-y-6">
          {/* Client et projet */}
          <Card>
            <CardHeader title="Client et projet" />
            <CardBody className="grid gap-6 md:grid-cols-2">
              <dl className="space-y-2 text-sm">
                <Row label="Nom" value={`${order.customer.firstName} ${order.customer.lastName}`} />
                <Row
                  label="Email"
                  value={
                    <a href={`mailto:${order.customer.email}`} className="underline">
                      {order.customer.email}
                    </a>
                  }
                />
                <Row label="Téléphone" value={formatPhone(order.customer.phone)} />
                {order.customer.whatsapp ? (
                  <Row label="WhatsApp" value={formatPhone(order.customer.whatsapp)} />
                ) : null}
                <Row label="Ville du projet" value={order.customer.city ?? '—'} />
                <Row
                  label="Consentement"
                  value={order.customer.consentAt ? formatDateTime(order.customer.consentAt) : '—'}
                />
              </dl>

              {order.simulation ? (
                <dl className="space-y-2 text-sm">
                  <Row label="Simulation" value={order.simulation.reference} />
                  <Row label="Type de projet" value={order.simulation.projectTypeNameSnapshot} />
                  <Row label="Surface" value={formatSurface(order.simulation.surface)} />
                  <Row label="Ville / zone" value={order.simulation.cityNameSnapshot} />
                  <Row label="Finition" value={order.simulation.finishNameSnapshot} />
                  <Row
                    label="Prix au m² retenu"
                    value={formatXOF(order.simulation.pricePerSquareMeterSnapshot)}
                  />
                  <Row
                    label="Estimation"
                    value={`${formatXOF(order.simulation.estimatedTotal)} (${formatXOF(order.simulation.estimatedMinimum, { withCurrency: false })} – ${formatXOF(order.simulation.estimatedMaximum, { withCurrency: false })})`}
                  />
                  {order.desiredStartDate ? (
                    <Row label="Démarrage souhaité" value={formatDate(order.desiredStartDate)} />
                  ) : null}
                </dl>
              ) : (
                <Alert tone="warning">Aucune simulation rattachée à cette commande.</Alert>
              )}
            </CardBody>
            {order.customerComment ? (
              <CardBody className="border-t border-sand-200">
                <p className="text-xs font-semibold uppercase text-ink-muted">
                  Commentaire du client
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                  {order.customerComment}
                </p>
              </CardBody>
            ) : null}
          </Card>

          {/* Rapport */}
          <Card>
            <CardHeader
              title="Préparation du rapport"
              description="Les montants sont saisis et validés par Kerplus. Aucun contenu n’est généré automatiquement."
              action={
                order.report ? (
                  <Badge tone={order.report.status === 'SENT' ? 'success' : 'neutral'}>
                    {order.report.status}
                  </Badge>
                ) : null
              }
            />
            <CardBody>
              {!isPaid ? (
                <Alert tone="warning" className="mb-4">
                  Le paiement n’est pas encore confirmé. Vous pouvez préparer le rapport, mais
                  l’envoi reste conditionné à la vérification du règlement.
                </Alert>
              ) : null}

              <ReportEditor
                orderId={order.id}
                csrfToken={csrfToken}
                estimationTotal={order.simulation?.estimatedTotal ?? null}
                defaultExclusions={defaultExclusions.join('\n')}
                defaultAssumptions={defaultAssumptions}
                initialItems={(order.report?.items ?? []).map((item) => ({
                  category: item.category,
                  label: item.label,
                  amount: item.amount,
                  percentage: item.percentage,
                  description: item.description ?? '',
                }))}
                initialContent={{
                  summary: order.report?.summary ?? '',
                  assumptions: order.report?.assumptions ?? '',
                  recommendations: order.report?.recommendations ?? '',
                  exclusions: order.report?.exclusions ?? '',
                  timeline: order.report?.timeline ?? '',
                  validatedBy: order.report?.validatedBy ?? '',
                }}
              />
            </CardBody>

            <CardBody className="grid gap-4 border-t border-sand-200 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold">Générer le PDF Kerplus</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Construit le document à partir des données enregistrées ci-dessus.
                </p>
                <ActionForm
                  action={generateReportPdfAction}
                  csrfToken={csrfToken}
                  hidden={{ orderId: order.id }}
                  submitLabel="Générer le PDF"
                  size="sm"
                />
              </div>

              <div>
                <h3 className="text-sm font-bold">Importer un PDF final</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Fichier PDF uniquement, 15 Mo maximum. Remplace le document existant.
                </p>
                <ActionForm
                  action={importReportPdfAction}
                  csrfToken={csrfToken}
                  hidden={{ orderId: order.id }}
                  submitLabel="Importer le PDF"
                  variant="ghost"
                  size="sm"
                >
                  <input
                    type="file"
                    name="file"
                    accept="application/pdf"
                    required
                    className="mt-2 block w-full text-sm"
                    aria-label="Fichier PDF du rapport"
                  />
                </ActionForm>
              </div>

              {order.report?.fileKey ? (
                <div className="md:col-span-2 space-y-3 rounded-xl bg-sand-50 p-4">
                  <p className="text-sm">
                    <strong>Document :</strong> {order.report.fileName} (
                    {Math.round((order.report.fileSize ?? 0) / 1024)} Ko)
                    {order.report.validatedAt
                      ? ` — préparé le ${formatDateTime(order.report.validatedAt)}`
                      : ''}
                    {order.report.preparedBy ? ` par ${order.report.preparedBy.name}` : ''}
                  </p>
                  <p className="text-sm text-ink-muted">
                    Téléchargements : {order.report.downloadCount}
                    {order.report.tokenExpiresAt
                      ? ` — lien actif jusqu’au ${formatDateTime(order.report.tokenExpiresAt)}`
                      : ' — aucun lien actif'}
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`/admin/rapports/${order.id}/apercu`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[40px] items-center rounded-xl border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-700 hover:bg-sand-50"
                    >
                      Prévisualiser le PDF
                    </a>
                    <ActionForm
                      action={markReportReadyAction}
                      csrfToken={csrfToken}
                      hidden={{ orderId: order.id }}
                      submitLabel="Marquer comme prêt"
                      variant="ghost"
                      size="sm"
                      className="[&>div]:mt-0"
                    />
                    <ActionForm
                      action={sendReportAction}
                      csrfToken={csrfToken}
                      hidden={{ orderId: order.id }}
                      submitLabel={order.report.sentAt ? 'Renvoyer au client' : 'Envoyer au client'}
                      confirmMessage="Envoyer le rapport au client avec un nouveau lien de téléchargement ?"
                      size="sm"
                      className="[&>div]:mt-0"
                    />
                    <ActionForm
                      action={reissueDownloadLinkAction}
                      csrfToken={csrfToken}
                      hidden={{ orderId: order.id }}
                      submitLabel="Nouveau lien"
                      variant="ghost"
                      size="sm"
                      className="[&>div]:mt-0"
                    />
                    <ActionForm
                      action={revokeDownloadLinkAction}
                      csrfToken={csrfToken}
                      hidden={{ orderId: order.id }}
                      submitLabel="Révoquer le lien"
                      variant="danger"
                      size="sm"
                      confirmMessage="Révoquer immédiatement le lien de téléchargement ?"
                      className="[&>div]:mt-0"
                    />
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* Journal d'audit */}
          <Card>
            <CardHeader title="Historique des actions" />
            <CardBody className="p-0 sm:p-0">
              {auditLogs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-muted">Aucune action enregistrée.</p>
              ) : (
                <ul className="divide-y divide-sand-200 text-sm">
                  {auditLogs.map((log) => (
                    <li key={log.id} className="flex flex-wrap gap-2 px-5 py-2.5">
                      <span className="font-mono text-xs text-ink-muted">
                        {formatDateTime(log.createdAt)}
                      </span>
                      <span className="font-semibold">{log.action}</span>
                      <span className="text-ink-muted">
                        {log.adminUser?.name ?? 'système'} — {log.entityType}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Colonne latérale */}
        <aside className="min-w-0 space-y-5">
          {/* Paiement */}
          <Card>
            <CardHeader title="Paiement" description={provider.label} />
            <CardBody className="space-y-4">
              {payment ? (
                <dl className="space-y-2 text-sm">
                  <Row label="Statut" value={PAYMENT_STATUS_LABELS[payment.status]} />
                  <Row label="Montant" value={formatXOF(payment.amount)} />
                  <Row label="Fournisseur" value={payment.provider} />
                  <Row label="Référence externe" value={payment.externalReference ?? '—'} />
                  <Row
                    label="Vérifié"
                    value={
                      payment.verified && payment.verifiedAt
                        ? formatDateTime(payment.verifiedAt)
                        : 'Non vérifié'
                    }
                  />
                </dl>
              ) : (
                <Alert tone="warning">Aucun paiement enregistré pour cette commande.</Alert>
              )}

              {payment && !isPaid ? (
                <div className="rounded-xl border border-ember-200 bg-ember-50 p-4">
                  <h3 className="text-sm font-bold text-ember-900">
                    Confirmer le paiement manuellement
                  </h3>
                  <p className="mt-1 text-xs text-ember-900">
                    À utiliser uniquement après vérification effective du règlement sur le compte
                    Wave. Cette action passe la commande en « Payée » et notifie le client.
                  </p>
                  <ActionForm
                    action={confirmPaymentAction}
                    csrfToken={csrfToken}
                    hidden={{ paymentId: payment.id }}
                    submitLabel="Confirmer le paiement"
                    confirmMessage="Confirmez-vous avoir vérifié la réception effective de ce paiement ?"
                    size="sm"
                  >
                    <div className="mt-3 space-y-2">
                      <input
                        name="externalReference"
                        required
                        minLength={3}
                        placeholder="Référence de la transaction Wave"
                        className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                        aria-label="Référence de la transaction"
                      />
                      <input
                        name="note"
                        placeholder="Note interne (facultatif)"
                        className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                        aria-label="Note interne"
                      />
                    </div>
                  </ActionForm>
                </div>
              ) : null}

              {payment ? (
                <ActionForm
                  action={updatePaymentStatusAction}
                  csrfToken={csrfToken}
                  hidden={{ paymentId: payment.id }}
                  submitLabel="Modifier le statut du paiement"
                  variant="ghost"
                  size="sm"
                >
                  <select
                    name="status"
                    defaultValue=""
                    required
                    className="mt-2 w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                    aria-label="Nouveau statut du paiement"
                  >
                    <option value="" disabled>
                      Choisir un statut…
                    </option>
                    <option value="PENDING">En attente</option>
                    <option value="PROCESSING">En cours</option>
                    <option value="FAILED">Échoué</option>
                    <option value="CANCELLED">Annulé</option>
                    <option value="REFUNDED">Remboursé</option>
                  </select>
                  <input
                    name="reason"
                    placeholder="Motif (facultatif)"
                    className="mt-2 w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                    aria-label="Motif du changement"
                  />
                </ActionForm>
              ) : null}
            </CardBody>
          </Card>

          {/* Statut de commande */}
          <Card>
            <CardHeader title="Statut de la commande" />
            <CardBody>
              {allowedTransitions.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Aucune transition disponible depuis le statut actuel.
                </p>
              ) : (
                <ActionForm
                  action={updateOrderStatusAction}
                  csrfToken={csrfToken}
                  hidden={{ orderId: order.id }}
                  submitLabel="Appliquer"
                  size="sm"
                >
                  <select
                    name="status"
                    defaultValue=""
                    required
                    className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                    aria-label="Nouveau statut de commande"
                  >
                    <option value="" disabled>
                      Choisir un statut…
                    </option>
                    {allowedTransitions.map((status) => (
                      <option key={status} value={status}>
                        {ORDER_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </ActionForm>
              )}
              <p className="mt-3 text-xs text-ink-muted">
                Le statut « Payée » ne peut être appliqué qu’en confirmant le paiement.
              </p>
            </CardBody>
          </Card>

          {/* Appel conseil */}
          <Card>
            <CardHeader
              title="Appel conseil"
              action={<Badge>{CALL_STATUS_LABELS[order.call?.status ?? 'NOT_SCHEDULED']}</Badge>}
            />
            <CardBody>
              <ActionForm
                action={updateConsultationCallAction}
                csrfToken={csrfToken}
                hidden={{ orderId: order.id }}
                submitLabel="Enregistrer l’appel"
                variant="ghost"
                size="sm"
              >
                <div className="space-y-3 text-sm">
                  <label className="block">
                    <span className="font-semibold text-forest-700">Statut</span>
                    <select
                      name="status"
                      defaultValue={order.call?.status ?? 'NOT_SCHEDULED'}
                      className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2"
                    >
                      {Object.entries(CALL_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-semibold text-forest-700">Date proposée</span>
                    <input
                      type="datetime-local"
                      name="proposedAt"
                      defaultValue={toDateTimeLocal(order.call?.proposedAt ?? null)}
                      className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-forest-700">Date confirmée</span>
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      defaultValue={toDateTimeLocal(order.call?.scheduledAt ?? null)}
                      className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-forest-700">Lien de visioconférence</span>
                    <input
                      name="meetingLink"
                      type="url"
                      placeholder="https://… (laisser vide pour un appel téléphonique)"
                      defaultValue={order.call?.meetingLink ?? ''}
                      className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="font-semibold text-forest-700">Notes internes</span>
                    <textarea
                      name="callNotes"
                      rows={3}
                      defaultValue={order.call?.internalNotes ?? ''}
                      className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </label>
                </div>
              </ActionForm>
            </CardBody>
          </Card>

          {/* Notes et emails */}
          <Card>
            <CardHeader title="Notes internes et emails" />
            <CardBody className="space-y-4">
              <ActionForm
                action={updateOrderNotesAction}
                csrfToken={csrfToken}
                hidden={{ orderId: order.id }}
                submitLabel="Enregistrer les notes"
                variant="ghost"
                size="sm"
              >
                <textarea
                  name="internalNotes"
                  rows={4}
                  defaultValue={order.internalNotes ?? ''}
                  placeholder="Suivi interne de la commande…"
                  className="w-full rounded-xl border border-sand-300 p-3 text-sm"
                  aria-label="Notes internes de la commande"
                />
              </ActionForm>

              <ActionForm
                action={resendOrderEmailAction}
                csrfToken={csrfToken}
                hidden={{ orderId: order.id }}
                submitLabel="Renvoyer l’email de commande"
                variant="ghost"
                size="sm"
              />
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-ink-muted">{label} :</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

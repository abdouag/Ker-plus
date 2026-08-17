import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Alert, Badge } from '@/components/ui/Feedback';
import { LinkButton } from '@/components/ui/Button';
import { prisma } from '@/lib/prisma';
import { isValidReference } from '@/lib/reference';
import { formatDate, formatDateTime, formatSurface, formatXOF } from '@/lib/format';
import { formatPhone, toWhatsAppDigits } from '@/lib/phone';
import {
  getCompanyContact,
  getReportDeliveryHours,
  getSettingString,
  SETTING_KEYS,
} from '@/lib/settings';
import { getActivePaymentProvider } from '@/lib/payments/registry';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/services/orders';
import { PaymentTracker } from '@/components/order/PaymentTracker';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirmation de commande',
  robots: { index: false, follow: false },
};

const STATUS_TONE = {
  DRAFT: 'neutral',
  AWAITING_PAYMENT: 'warning',
  PAID: 'success',
  IN_PREPARATION: 'info',
  READY: 'info',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'danger',
} as const;

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ paiement?: string }>;
}) {
  const { reference } = await params;
  const { paiement } = await searchParams;

  if (!isValidReference(reference)) notFound();

  const order = await prisma.order.findUnique({
    where: { reference },
    include: {
      customer: true,
      simulation: true,
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) notFound();

  const payment = order.payments[0] ?? null;
  const [company, deliveryHours, instructions, wavePaymentUrl] = await Promise.all([
    getCompanyContact(),
    getReportDeliveryHours(),
    getSettingString(SETTING_KEYS.PAYMENT_INSTRUCTIONS),
    getSettingString(SETTING_KEYS.WAVE_PAYMENT_URL),
  ]);

  const provider = getActivePaymentProvider();
  const paymentUrl = wavePaymentUrl || process.env.WAVE_PAYMENT_URL || '';
  const isPaid = payment?.status === 'PAID' && payment.verified;

  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-12">
        <PaymentTracker paid={isPaid} amount={order.amount} />

        <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
          Commande enregistrée
        </p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Commande n° {order.reference}</h1>

        {paiement === 'annule' ? (
          <Alert tone="warning" className="mt-4">
            Le paiement a été interrompu. Votre commande reste enregistrée : vous pouvez relancer le
            règlement ci-dessous.
          </Alert>
        ) : null}

        {isPaid ? (
          <Alert tone="success" title="Paiement confirmé" className="mt-4">
            Notre équipe a vérifié votre règlement. Votre rapport est en préparation et vous sera
            transmis{' '}
            {order.dueAt ? `au plus tard le ${formatDate(order.dueAt)}` : `sous ${deliveryHours} h`}
            .
          </Alert>
        ) : (
          <Alert tone="warning" title="Paiement en attente de vérification" className="mt-4">
            Votre commande est enregistrée. Elle sera confirmée <strong>uniquement</strong> après
            vérification effective de votre règlement par notre équipe. Aucun statut « payé » n’est
            appliqué automatiquement après une simple redirection.
          </Alert>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Récapitulatif de la commande" />
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Row label="Numéro de commande" value={order.reference} />
                  <Row label="Montant" value={formatXOF(order.amount)} />
                  <Row label="Moyen de paiement" value={provider.label} />
                  <Row
                    label="Statut de la commande"
                    value={
                      <Badge tone={STATUS_TONE[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    }
                  />
                  <Row
                    label="Statut du paiement"
                    value={payment ? PAYMENT_STATUS_LABELS[payment.status] : 'Non initié'}
                  />
                  <Row label="Date de commande" value={formatDateTime(order.createdAt)} />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Vos coordonnées" />
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Row
                    label="Nom et prénom"
                    value={`${order.customer.firstName} ${order.customer.lastName}`}
                  />
                  <Row label="Téléphone" value={formatPhone(order.customer.phone)} />
                  <Row label="Email" value={order.customer.email} />
                  {order.customer.whatsapp ? (
                    <Row label="WhatsApp" value={formatPhone(order.customer.whatsapp)} />
                  ) : null}
                </dl>
              </CardBody>
            </Card>

            {order.simulation ? (
              <Card>
                <CardHeader
                  title="Résumé de votre projet"
                  description={`Simulation ${order.simulation.reference}`}
                />
                <CardBody>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Row label="Type de projet" value={order.simulation.projectTypeNameSnapshot} />
                    <Row label="Surface totale" value={formatSurface(order.simulation.surface)} />
                    <Row label="Ville ou zone" value={order.simulation.cityNameSnapshot} />
                    <Row label="Niveau de finition" value={order.simulation.finishNameSnapshot} />
                    <Row
                      label="Estimation indicative"
                      value={formatXOF(order.simulation.estimatedTotal)}
                    />
                    <Row
                      label="Fourchette"
                      value={`${formatXOF(order.simulation.estimatedMinimum, { withCurrency: false })} à ${formatXOF(order.simulation.estimatedMaximum)}`}
                    />
                    {order.desiredStartDate ? (
                      <Row label="Démarrage souhaité" value={formatDate(order.desiredStartDate)} />
                    ) : null}
                  </dl>
                  {order.customerComment ? (
                    <div className="mt-4 rounded-xl bg-sand-50 p-4">
                      <p className="text-xs font-semibold uppercase text-ink-muted">
                        Votre commentaire
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                        {order.customerComment}
                      </p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <Card>
              <CardHeader title="Régler ma commande" />
              <CardBody className="space-y-4">
                <p className="text-sm leading-relaxed text-ink-soft">{instructions}</p>
                {!isPaid && paymentUrl ? (
                  <LinkButton
                    href={paymentUrl}
                    size="lg"
                    fullWidth
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Payer {formatXOF(order.amount)} avec Wave
                  </LinkButton>
                ) : null}
                {!isPaid && !paymentUrl ? (
                  <Alert tone="warning">
                    Le lien de paiement n’est pas encore configuré. Contactez Kerplus pour finaliser
                    votre règlement.
                  </Alert>
                ) : null}
                {company.whatsapp ? (
                  <LinkButton
                    href={`https://wa.me/${toWhatsAppDigits(company.whatsapp)}?text=${encodeURIComponent(
                      `Bonjour Kerplus, je viens de passer la commande ${order.reference}.`,
                    )}`}
                    variant="secondary"
                    fullWidth
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contacter Kerplus sur WhatsApp
                  </LinkButton>
                ) : null}
                {company.email ? (
                  <p className="text-center text-sm text-ink-muted">
                    ou par email :{' '}
                    <a href={`mailto:${company.email}`} className="font-semibold underline">
                      {company.email}
                    </a>
                  </p>
                ) : null}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-2 text-sm text-ink-soft">
                <p className="font-bold text-forest-700">Et ensuite ?</p>
                <p>
                  Après vérification du paiement, votre rapport technique détaillé est préparé et
                  livré sous {deliveryHours} heures, puis un appel conseil est organisé avec notre
                  équipe.
                </p>
                <p className="text-xs text-ink-muted">
                  Conservez ce numéro de commande : {order.reference}.
                </p>
                <p className="pt-2">
                  <Link href="/" className="font-semibold text-forest-600 underline">
                    Retour à l’estimateur
                  </Link>
                </p>
              </CardBody>
            </Card>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-ink">{value}</dd>
    </div>
  );
}

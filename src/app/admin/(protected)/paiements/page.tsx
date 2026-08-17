import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/guard';
import { getCsrfToken } from '@/lib/security/csrf';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert, Badge, EmptyState } from '@/components/ui/Feedback';
import { FILTER_INPUT_CLASS, FilterBar, FilterField } from '@/components/admin/FilterBar';
import { Pagination } from '@/components/admin/Pagination';
import { ActionForm } from '@/components/admin/ActionForm';
import { confirmPaymentAction } from '@/app/admin/actions/orders';
import { formatDateTime, formatXOF } from '@/lib/format';
import { PAYMENT_STATUS_LABELS } from '@/lib/services/orders';
import { getActivePaymentProvider } from '@/lib/payments/registry';
import { PAGE_SIZE, parsePage, paymentWhere, type ListParams } from '@/lib/admin/queries';
import { getSettingString, SETTING_KEYS } from '@/lib/settings';

export const metadata: Metadata = { title: 'Paiements' };
export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireAdmin('/admin/paiements');
  const params = await searchParams;
  const page = parsePage(params.page);
  const where = paymentWhere(params);
  const csrfToken = await getCsrfToken();
  const provider = getActivePaymentProvider();
  // Le lien Wave peut provenir de la variable d'environnement ou du paramètre.
  const providerConfigured =
    provider.isConfigured() ||
    (provider.id === 'wave_link' && Boolean(await getSettingString(SETTING_KEYS.WAVE_PAYMENT_URL)));

  const [total, payments, collected] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: { order: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', verified: true },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Paiements</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Fournisseur actif : <strong>{provider.label}</strong>.{' '}
          {provider.requiresManualConfirmation
            ? 'La confirmation est manuelle : vérifiez le règlement avant de valider.'
            : 'Les notifications signées du fournisseur confirment automatiquement les paiements.'}
        </p>
      </div>

      {!providerConfigured ? (
        <Alert tone="warning" title="Configuration incomplète">
          {provider.configurationHint()}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase text-emerald-800">Encaissé et vérifié</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">
            {formatXOF(collected._sum.amount ?? 0)}
          </p>
          <p className="text-xs text-emerald-800">{collected._count} paiement(s) confirmé(s)</p>
        </div>
      </div>

      <FilterBar action="/admin/paiements">
        <FilterField label="Recherche">
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Commande ou référence de transaction"
            className={`${FILTER_INPUT_CLASS} w-72`}
          />
        </FilterField>
        <FilterField label="Statut">
          <select name="statut" defaultValue={params.statut ?? ''} className={FILTER_INPUT_CLASS}>
            <option value="">Tous</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Du">
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ''}
            className={FILTER_INPUT_CLASS}
          />
        </FilterField>
        <FilterField label="Au">
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ''}
            className={FILTER_INPUT_CLASS}
          />
        </FilterField>
      </FilterBar>

      <Card>
        <CardBody className="p-0 sm:p-0">
          {payments.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Aucun paiement" description="Aucun paiement ne correspond." />
            </div>
          ) : (
            <ul className="divide-y divide-sand-200">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_320px]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/commandes/${payment.orderId}`}
                        className="font-semibold text-forest-600 underline"
                      >
                        {payment.order.reference}
                      </Link>
                      <Badge tone={payment.status === 'PAID' ? 'success' : 'warning'}>
                        {PAYMENT_STATUS_LABELS[payment.status]}
                      </Badge>
                      {payment.verified ? <Badge tone="success">Vérifié</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {payment.order.customer.firstName} {payment.order.customer.lastName} —{' '}
                      {payment.order.customer.email}
                    </p>
                    <p className="mt-1 text-sm">
                      <strong>{formatXOF(payment.amount)}</strong>{' '}
                      <span className="text-ink-muted">
                        · {payment.provider} · créé le {formatDateTime(payment.createdAt)}
                      </span>
                    </p>
                    {payment.externalReference ? (
                      <p className="text-sm text-ink-muted">
                        Référence transaction : {payment.externalReference}
                      </p>
                    ) : null}
                    {payment.verifiedAt ? (
                      <p className="text-sm text-ink-muted">
                        Vérifié le {formatDateTime(payment.verifiedAt)}
                      </p>
                    ) : null}
                  </div>

                  {payment.status !== 'PAID' ? (
                    <ActionForm
                      action={confirmPaymentAction}
                      csrfToken={csrfToken}
                      hidden={{ paymentId: payment.id }}
                      submitLabel="Confirmer le paiement"
                      size="sm"
                      confirmMessage="Confirmez-vous avoir vérifié la réception effective de ce paiement ?"
                    >
                      <input
                        name="externalReference"
                        required
                        minLength={3}
                        placeholder="Référence de la transaction"
                        className="w-full rounded-xl border border-sand-300 px-3 py-2 text-sm"
                        aria-label={`Référence de transaction pour ${payment.order.reference}`}
                      />
                    </ActionForm>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/admin/paiements"
            params={params as Record<string, string | undefined>}
          />
        </CardBody>
      </Card>
    </div>
  );
}

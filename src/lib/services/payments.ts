import 'server-only';

import { Prisma, type Payment, type PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { buildPaymentConfirmedEmail } from '@/lib/email/templates';
import { getCompanyContact, getReportDeliveryHours } from '@/lib/settings';
import { getActivePaymentProvider } from '@/lib/payments/registry';
import type { WebhookVerificationResult } from '@/lib/payments/types';

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Marque un paiement comme réglé et fait basculer la commande en PAID.
 * Opération idempotente : un paiement déjà confirmé n'est jamais rejoué.
 */
async function markPaymentAsPaid(options: {
  paymentId: string;
  externalReference?: string | null;
  providerTransactionId?: string | null;
  verifiedById?: string | null;
  source: 'manual' | 'webhook';
  note?: string | null;
}): Promise<{ alreadyPaid: boolean; payment: Payment }> {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: options.paymentId },
      include: { order: true },
    });
    if (!payment) {
      throw new PaymentError('Paiement introuvable.', 404);
    }
    if (payment.status === 'PAID' && payment.verified) {
      return { alreadyPaid: true, payment, orderId: payment.orderId };
    }
    if (payment.order.status === 'CANCELLED' || payment.order.status === 'REFUNDED') {
      throw new PaymentError(
        'La commande associée est annulée ou remboursée : confirmation impossible.',
        409,
      );
    }

    const now = new Date();
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        verified: true,
        verifiedAt: now,
        verifiedById: options.verifiedById ?? null,
        externalReference: options.externalReference ?? payment.externalReference,
        providerTransactionId: options.providerTransactionId ?? payment.providerTransactionId,
        failureReason: null,
        metadata: {
          ...((payment.metadata as Prisma.JsonObject | null) ?? {}),
          confirmationSource: options.source,
          ...(options.note ? { adminNote: options.note } : {}),
        },
      },
    });

    const deliveryHours = await getReportDeliveryHours();
    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'PAID',
        paidAt: payment.order.paidAt ?? now,
        dueAt: new Date(now.getTime() + deliveryHours * 3600 * 1000),
      },
    });

    // Squelette de rapport créé dès le paiement afin que l'équipe puisse
    // commencer la préparation. Aucun contenu n'est généré automatiquement.
    await tx.report.upsert({
      where: { orderId: payment.orderId },
      update: {},
      create: { orderId: payment.orderId, status: 'DRAFT' },
    });

    return { alreadyPaid: false, payment: updatedPayment, orderId: payment.orderId };
  });

  if (!result.alreadyPaid) {
    await notifyPaymentConfirmed(result.orderId);
  }

  return { alreadyPaid: result.alreadyPaid, payment: result.payment };
}

async function notifyPaymentConfirmed(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });
  if (!order) return;
  const company = await getCompanyContact();
  await sendEmail(
    buildPaymentConfirmedEmail({
      customerFirstName: order.customer.firstName,
      customerEmail: order.customer.email,
      orderReference: order.reference,
      amount: order.amount,
      paidAt: order.paidAt ?? new Date(),
      dueAt: order.dueAt,
      companyName: company.name,
      companyEmail: company.email,
      orderUrl: `${env.siteUrl}/commande/${order.reference}`,
    }),
  );
}

/**
 * Confirmation manuelle par un administrateur (mode lien de paiement).
 * C'est le SEUL moyen de valider un paiement lorsque le fournisseur n'expose
 * pas de notification vérifiable.
 */
export async function confirmPaymentManually(input: {
  paymentId: string;
  adminUserId: string;
  externalReference: string;
  note?: string;
}): Promise<{ alreadyPaid: boolean }> {
  const before = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!before) throw new PaymentError('Paiement introuvable.', 404);

  const { alreadyPaid, payment } = await markPaymentAsPaid({
    paymentId: input.paymentId,
    externalReference: input.externalReference,
    verifiedById: input.adminUserId,
    source: 'manual',
    note: input.note ?? null,
  });

  await recordAudit({
    adminUserId: input.adminUserId,
    action: alreadyPaid ? 'payment.confirm.noop' : 'payment.confirm.manual',
    entityType: 'Payment',
    entityId: payment.id,
    before,
    after: payment,
  });

  return { alreadyPaid };
}

/** Marque un paiement comme échoué / annulé (action administrateur). */
export async function updatePaymentStatus(input: {
  paymentId: string;
  status: Extract<PaymentStatus, 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PROCESSING' | 'PENDING'>;
  adminUserId: string;
  reason?: string;
}): Promise<void> {
  const before = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!before) throw new PaymentError('Paiement introuvable.', 404);

  const after = await prisma.payment.update({
    where: { id: input.paymentId },
    data: {
      status: input.status,
      failureReason: input.reason ?? null,
      verified: input.status === 'REFUNDED' ? before.verified : false,
    },
  });

  if (input.status === 'REFUNDED') {
    await prisma.order.update({ where: { id: before.orderId }, data: { status: 'REFUNDED' } });
  }

  await recordAudit({
    adminUserId: input.adminUserId,
    action: `payment.status.${input.status.toLowerCase()}`,
    entityType: 'Payment',
    entityId: input.paymentId,
    before,
    after,
  });
}

export interface WebhookOutcome {
  status: number;
  body: { received: boolean; message: string; duplicate?: boolean };
}

/**
 * Traitement d'une notification fournisseur.
 *
 * Règles :
 *  - la signature est vérifiée avant toute écriture métier ;
 *  - chaque événement est journalisé une seule fois (contrainte unique
 *    provider + eventId) ce qui garantit l'idempotence ;
 *  - une notification invalide ne modifie jamais une commande.
 */
export async function processPaymentWebhook(
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const provider = getActivePaymentProvider();
  let verification: WebhookVerificationResult;

  try {
    verification = await provider.verifyWebhook(rawBody, headers);
  } catch (error) {
    console.error('[webhook] vérification impossible', {
      provider: provider.id,
      message: error instanceof Error ? error.message : 'erreur inconnue',
    });
    return { status: 400, body: { received: false, message: 'Notification illisible.' } };
  }

  if (!verification.valid) {
    console.warn('[webhook] notification rejetée', {
      provider: provider.id,
      reason: verification.reason,
    });
    return {
      status: 400,
      body: { received: false, message: verification.reason ?? 'Notification invalide.' },
    };
  }

  const eventId = verification.eventId?.trim();
  if (!eventId) {
    return {
      status: 400,
      body: { received: false, message: 'Identifiant d’événement absent.' },
    };
  }

  // Idempotence : la contrainte unique (provider, eventId) fait office de verrou.
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: provider.id,
        eventId,
        eventType: verification.eventType ?? 'unknown',
        payload: (verification.payload ?? {}) as Prisma.InputJsonValue,
        signatureValid: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return {
        status: 200,
        body: { received: true, message: 'Événement déjà traité.', duplicate: true },
      };
    }
    throw error;
  }

  const payment = await findPaymentForWebhook(verification);
  if (!payment) {
    await prisma.paymentEvent.update({
      where: { provider_eventId: { provider: provider.id, eventId } },
      data: { processedAt: new Date() },
    });
    return {
      status: 202,
      body: { received: true, message: 'Paiement correspondant introuvable.' },
    };
  }

  if (verification.amount !== undefined && verification.amount !== payment.amount) {
    console.warn('[webhook] montant divergent', {
      paymentId: payment.id,
      expected: payment.amount,
      received: verification.amount,
    });
    await prisma.paymentEvent.update({
      where: { provider_eventId: { provider: provider.id, eventId } },
      data: { paymentId: payment.id, processedAt: new Date() },
    });
    return { status: 409, body: { received: true, message: 'Montant non conforme.' } };
  }

  if (verification.status === 'PAID') {
    await markPaymentAsPaid({
      paymentId: payment.id,
      externalReference: verification.externalReference ?? null,
      providerTransactionId: verification.providerTransactionId ?? null,
      source: 'webhook',
    });
  } else if (verification.status === 'FAILED' || verification.status === 'CANCELLED') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: verification.status, verified: false },
    });
  } else if (payment.status === 'PENDING') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PROCESSING' } });
  }

  await prisma.paymentEvent.update({
    where: { provider_eventId: { provider: provider.id, eventId } },
    data: { paymentId: payment.id, processedAt: new Date() },
  });

  return { status: 200, body: { received: true, message: 'Notification traitée.' } };
}

async function findPaymentForWebhook(
  verification: WebhookVerificationResult,
): Promise<Payment | null> {
  if (verification.providerTransactionId) {
    const byTransaction = await prisma.payment.findFirst({
      where: { providerTransactionId: verification.providerTransactionId },
      orderBy: { createdAt: 'desc' },
    });
    if (byTransaction) return byTransaction;
  }

  const reference = verification.orderReference ?? verification.externalReference;
  if (reference) {
    const order = await prisma.order.findUnique({
      where: { reference },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return order?.payments[0] ?? null;
  }

  return null;
}

import 'server-only';

import type { Order, Payment, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { generateUniqueReference } from '@/lib/reference';
import { normalizePhone } from '@/lib/phone';
import { formatSurface, formatXOF } from '@/lib/format';
import {
  getCompanyContact,
  getPremiumReportPrice,
  getReportDeliveryHours,
  getSettingBool,
  getSettingString,
  SETTING_KEYS,
} from '@/lib/settings';
import { getActivePaymentProvider } from '@/lib/payments/registry';
import { PaymentConfigurationError } from '@/lib/payments/types';
import { sendEmail } from '@/lib/email';
import { buildOrderCreatedEmail } from '@/lib/email/templates';
import type { CreateOrderPayload } from '@/lib/validation/schemas';
import { computeServerEstimation, persistSimulation } from './estimation';

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

export interface CreateOrderContext {
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface CreateOrderResult {
  order: Order;
  payment: Payment;
  simulationReference: string;
  redirectUrl?: string;
  instructions?: string;
  providerLabel: string;
  requiresManualConfirmation: boolean;
}

function resolveWhatsapp(payload: CreateOrderPayload, normalizedPhone: string): string {
  if (payload.whatsappSameAsPhone) return normalizedPhone;
  const value = payload.whatsapp?.trim() ?? '';
  return normalizePhone(value)?.value ?? value;
}

/**
 * Crée ou met à jour le client, en le retrouvant par (email, téléphone).
 * Aucune fusion agressive : deux couples différents restent deux fiches.
 */
async function upsertCustomer(
  tx: Prisma.TransactionClient,
  payload: CreateOrderPayload,
  whatsapp: string,
) {
  return tx.customer.upsert({
    where: { email_phone: { email: payload.email, phone: payload.phone } },
    update: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      whatsapp,
      city: payload.city,
      consentAt: new Date(),
    },
    create: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      whatsapp,
      city: payload.city,
      consentAt: new Date(),
    },
  });
}

/**
 * Rattache une simulation anonyme déjà enregistrée au client, si et seulement
 * si elle correspond trait pour trait au recalcul serveur.
 */
async function reuseSimulation(
  tx: Prisma.TransactionClient,
  reference: string | undefined,
  snapshot: Awaited<ReturnType<typeof computeServerEstimation>>,
  customerId: string,
) {
  if (!reference) return null;
  const candidate = await tx.simulation.findUnique({ where: { reference } });
  if (!candidate || candidate.customerId) return null;

  const matches =
    candidate.projectTypeId === snapshot.projectTypeId &&
    candidate.cityZoneId === snapshot.cityZoneId &&
    candidate.finishLevelId === snapshot.finishLevelId &&
    candidate.surface === snapshot.surface &&
    candidate.estimatedTotal === snapshot.estimatedTotal &&
    candidate.estimatedMinimum === snapshot.estimatedMinimum &&
    candidate.estimatedMaximum === snapshot.estimatedMaximum;

  if (!matches) return null;
  return tx.simulation.update({ where: { id: candidate.id }, data: { customerId } });
}

/**
 * Parcours complet de commande :
 *  1. recalcul serveur de l'estimation ;
 *  2. enregistrement du client et de la simulation ;
 *  3. création de la commande avec un montant figé ;
 *  4. création d'un paiement au statut PENDING ;
 *  5. initialisation auprès du fournisseur (redirection éventuelle).
 *
 * Aucune étape ne fait confiance à un montant transmis par le navigateur.
 */
export async function createOrder(
  payload: CreateOrderPayload,
  context: CreateOrderContext = {},
): Promise<CreateOrderResult> {
  const orderEnabled = await getSettingBool(SETTING_KEYS.ORDER_ENABLED, true);
  if (!orderEnabled) {
    throw new OrderError(
      'La commande de rapport est temporairement indisponible. Merci de réessayer plus tard.',
      503,
    );
  }

  const snapshot = await computeServerEstimation({
    projectTypeId: payload.projectTypeId,
    surface: payload.surface,
    cityZoneId: payload.cityZoneId,
    finishLevelId: payload.finishLevelId,
  });

  const amount = await getPremiumReportPrice();
  if (!Number.isInteger(amount) || amount < 0) {
    throw new OrderError('Prix du rapport mal configuré. Contactez Kerplus.', 500);
  }

  const deliveryHours = await getReportDeliveryHours();
  const whatsapp = resolveWhatsapp(payload, payload.phone);

  const { order, payment, simulationReference } = await prisma.$transaction(async (tx) => {
    const customer = await upsertCustomer(tx, payload, whatsapp);

    // Réutilise la simulation déjà enregistrée si elle correspond exactement aux
    // paramètres recalculés : évite de dupliquer une ligne pour un même calcul.
    const simulation =
      (await reuseSimulation(tx, payload.simulationReference, snapshot, customer.id)) ??
      (await persistSimulation(snapshot, {
        customerId: customer.id,
        ipHash: context.ipHash,
        userAgent: context.userAgent,
        utmSource: payload.utmSource ?? null,
        utmMedium: payload.utmMedium ?? null,
        utmCampaign: payload.utmCampaign ?? null,
        client: tx,
      }));

    const reference = await generateUniqueReference('CMD', async (candidate) => {
      const existing = await tx.order.findUnique({
        where: { reference: candidate },
        select: { id: true },
      });
      return existing !== null;
    });

    const createdOrder = await tx.order.create({
      data: {
        reference,
        customerId: customer.id,
        simulationId: simulation.id,
        status: 'DRAFT',
        amount,
        currency: 'XOF',
        customerComment: payload.comment?.trim() || null,
        desiredStartDate: payload.desiredStartDate ? new Date(payload.desiredStartDate) : null,
        requestedServices: payload.requestedServices,
      },
    });

    // Une ligne de suivi par service réel demandé (« conseillez-moi » n'est
    // pas un service à piloter : il reste visible via requestedServices).
    const trackableServices = payload.requestedServices.filter(
      (key) => key !== 'needs_guidance',
    );
    if (trackableServices.length > 0) {
      await tx.orderService.createMany({
        data: trackableServices.map((serviceKey) => ({
          orderId: createdOrder.id,
          serviceKey,
        })),
      });
    }

    const createdPayment = await tx.payment.create({
      data: {
        orderId: createdOrder.id,
        provider: env.payment.provider,
        status: 'PENDING',
        amount,
        currency: 'XOF',
      },
    });

    await tx.consultationCall.create({
      data: { orderId: createdOrder.id, status: 'NOT_SCHEDULED' },
    });

    return {
      order: createdOrder,
      payment: createdPayment,
      simulationReference: simulation.reference,
    };
  });

  const provider = getActivePaymentProvider();
  let redirectUrl: string | undefined;
  let instructions: string | undefined;
  let providerTransactionId: string | undefined;

  try {
    const initialization = await provider.createPayment({
      orderReference: order.reference,
      amount: order.amount,
      currency: order.currency,
      customerName: `${payload.firstName} ${payload.lastName}`,
      customerEmail: payload.email,
      customerPhone: payload.phone,
      returnUrl: `${env.siteUrl}/commande/${order.reference}`,
      cancelUrl: `${env.siteUrl}/commande/${order.reference}?paiement=annule`,
    });
    redirectUrl = initialization.redirectUrl;
    instructions = initialization.instructions;
    providerTransactionId = initialization.providerTransactionId;
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      console.error('[orders] fournisseur de paiement non configuré', { message: error.message });
    } else {
      console.error('[orders] initialisation du paiement impossible', {
        orderReference: order.reference,
        message: error instanceof Error ? error.message : 'erreur inconnue',
      });
    }
    // La commande reste enregistrée : l'administrateur pourra la traiter.
  }

  const dueAt = new Date(Date.now() + deliveryHours * 3600 * 1000);
  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { status: 'AWAITING_PAYMENT', dueAt },
  });

  const updatedPayment = providerTransactionId
    ? await prisma.payment.update({
        where: { id: payment.id },
        data: { providerTransactionId, status: 'PROCESSING' },
      })
    : payment;

  // Notification client — un échec d'envoi ne remet jamais la commande en cause.
  const company = await getCompanyContact();
  const paymentInstructions =
    instructions ??
    (await getSettingString(
      SETTING_KEYS.PAYMENT_INSTRUCTIONS,
      'Vous recevrez les instructions de paiement par email.',
    ));

  await sendEmail(
    buildOrderCreatedEmail({
      customerFirstName: payload.firstName,
      customerEmail: payload.email,
      orderReference: updatedOrder.reference,
      amount: updatedOrder.amount,
      paymentLabel: provider.label,
      paymentInstructions,
      projectSummary: `${snapshot.projectTypeNameSnapshot} — ${formatSurface(snapshot.surface)} — ${snapshot.cityNameSnapshot} — finition ${snapshot.finishNameSnapshot} — estimation ${formatXOF(snapshot.estimatedTotal)}`,
      deliveryHours,
      companyName: company.name,
      companyEmail: company.email,
      orderUrl: `${env.siteUrl}/commande/${updatedOrder.reference}`,
    }),
  );

  if (env.email.internalNotification) {
    await sendEmail({
      to: env.email.internalNotification,
      subject: `[Kerplus] Nouvelle commande ${updatedOrder.reference} — ${formatXOF(updatedOrder.amount)}`,
      text: [
        `Commande : ${updatedOrder.reference}`,
        `Client : ${payload.firstName} ${payload.lastName} (${payload.email}, ${payload.phone})`,
        `Projet : ${snapshot.projectTypeNameSnapshot}, ${formatSurface(snapshot.surface)}, ${snapshot.cityNameSnapshot}, ${snapshot.finishNameSnapshot}`,
        `Estimation : ${formatXOF(snapshot.estimatedTotal)}`,
        `Simulation : ${simulationReference}`,
        'Paiement en attente de vérification.',
      ].join('\n'),
      html: `<p>Nouvelle commande <strong>${updatedOrder.reference}</strong> — paiement en attente de vérification.</p>`,
    });
  }

  return {
    order: updatedOrder,
    payment: updatedPayment,
    simulationReference,
    redirectUrl,
    instructions: paymentInstructions,
    providerLabel: provider.label,
    requiresManualConfirmation: provider.requiresManualConfirmation,
  };
}

/** Transitions de statut autorisées (contrôle serveur strict). */
export const ORDER_TRANSITIONS: Record<Order['status'], Order['status'][]> = {
  DRAFT: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['IN_PREPARATION', 'REFUNDED', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'PAID', 'CANCELLED'],
  READY: ['DELIVERED', 'IN_PREPARATION'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: Order['status'], to: Order['status']): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ORDER_STATUS_LABELS: Record<Order['status'], string> = {
  DRAFT: 'Brouillon',
  AWAITING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  IN_PREPARATION: 'Rapport en préparation',
  READY: 'Rapport prêt',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

export const PAYMENT_STATUS_LABELS: Record<Payment['status'], string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  PAID: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
  REFUNDED: 'Remboursé',
};

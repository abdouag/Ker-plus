'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/guard';
import { assertCsrf } from '@/lib/security/csrf';
import { recordAudit } from '@/lib/audit';
import { canTransition, OrderError } from '@/lib/services/orders';
import { confirmPaymentManually, updatePaymentStatus, PaymentError } from '@/lib/services/payments';
import { callStatusSchema, manualPaymentSchema, orderStatusSchema } from '@/lib/validation/schemas';
import { readText, toActionState, type ActionState } from './shared';

/**
 * Confirmation manuelle d'un paiement.
 *
 * Cette action est la seule voie de validation en mode « lien de paiement ».
 * Elle exige une référence de transaction et journalise l'auteur de la
 * vérification.
 */
export async function confirmPaymentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');

    const parsed = manualPaymentSchema.safeParse({
      paymentId: readText(formData, 'paymentId', 64),
      externalReference: readText(formData, 'externalReference', 120),
      note: readText(formData, 'note', 1000),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
    }

    const { alreadyPaid } = await confirmPaymentManually({
      paymentId: parsed.data.paymentId,
      adminUserId: admin.id,
      externalReference: parsed.data.externalReference,
      note: parsed.data.note || undefined,
    });

    revalidatePath('/admin/commandes');
    revalidatePath('/admin/paiements');
    return {
      ok: true,
      message: alreadyPaid
        ? 'Ce paiement était déjà confirmé : aucune modification.'
        : 'Paiement confirmé. Le client a été notifié.',
    };
  } catch (error) {
    return toActionState(error, 'confirmation manuelle de paiement');
  }
}

/** Marque un paiement comme échoué, annulé ou remboursé. */
export async function updatePaymentStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');

    const paymentId = readText(formData, 'paymentId', 64);
    const status = readText(formData, 'status', 20);
    const allowed = ['PENDING', 'PROCESSING', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;
    const target = allowed.find((value) => value === status);
    if (!target) return { ok: false, error: 'Statut de paiement non autorisé.' };

    await updatePaymentStatus({
      paymentId,
      status: target,
      adminUserId: admin.id,
      reason: readText(formData, 'reason', 500) || undefined,
    });

    revalidatePath('/admin/commandes');
    revalidatePath('/admin/paiements');
    return { ok: true, message: 'Statut du paiement mis à jour.' };
  } catch (error) {
    return toActionState(error, 'mise à jour du statut de paiement');
  }
}

/** Changement de statut de commande, restreint aux transitions autorisées. */
export async function updateOrderStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');

    const orderId = readText(formData, 'orderId', 64);
    const parsed = orderStatusSchema.safeParse(readText(formData, 'status', 30));
    if (!parsed.success) return { ok: false, error: 'Statut inconnu.' };

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError('Commande introuvable.', 404);

    if (order.status === parsed.data) {
      return { ok: true, message: 'Statut inchangé.' };
    }
    if (!canTransition(order.status, parsed.data)) {
      throw new OrderError(`Transition non autorisée : ${order.status} → ${parsed.data}.`, 409);
    }
    // Le passage à PAID relève exclusivement de la vérification de paiement.
    if (parsed.data === 'PAID') {
      throw new OrderError(
        'Le statut « Payée » ne peut être appliqué qu’en confirmant le paiement correspondant.',
        409,
      );
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: parsed.data,
        ...(parsed.data === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    });

    await recordAudit({
      adminUserId: admin.id,
      action: 'order.status.update',
      entityType: 'Order',
      entityId: orderId,
      before: { status: order.status },
      after: { status: updated.status },
    });

    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/commandes');
    return { ok: true, message: 'Statut de la commande mis à jour.' };
  } catch (error) {
    return toActionState(error, 'mise à jour du statut de commande');
  }
}

/** Notes internes attachées à une commande. */
export async function updateOrderNotesAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');

    const orderId = readText(formData, 'orderId', 64);
    const notes = readText(formData, 'internalNotes', 4000);

    const before = await prisma.order.findUnique({ where: { id: orderId } });
    if (!before) throw new OrderError('Commande introuvable.', 404);

    await prisma.order.update({ where: { id: orderId }, data: { internalNotes: notes || null } });

    await recordAudit({
      adminUserId: admin.id,
      action: 'order.notes.update',
      entityType: 'Order',
      entityId: orderId,
      before: { internalNotes: before.internalNotes },
      after: { internalNotes: notes },
    });

    revalidatePath(`/admin/commandes/${orderId}`);
    return { ok: true, message: 'Notes enregistrées.' };
  } catch (error) {
    return toActionState(error, 'mise à jour des notes de commande');
  }
}

/** Gestion de l'appel conseil de 20 minutes. */
export async function updateConsultationCallAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');

    const orderId = readText(formData, 'orderId', 64);
    const parsedStatus = callStatusSchema.safeParse(readText(formData, 'status', 30));
    if (!parsedStatus.success) return { ok: false, error: 'Statut d’appel inconnu.' };

    const proposedAt = readText(formData, 'proposedAt', 40);
    const scheduledAt = readText(formData, 'scheduledAt', 40);
    const meetingLink = readText(formData, 'meetingLink', 500);

    if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
      return {
        ok: false,
        error: 'Le lien de visioconférence doit commencer par http:// ou https://.',
      };
    }

    const before = await prisma.consultationCall.findUnique({ where: { orderId } });

    const data = {
      status: parsedStatus.data,
      proposedAt: proposedAt ? new Date(proposedAt) : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      completedAt: parsedStatus.data === 'COMPLETED' ? new Date() : null,
      meetingLink: meetingLink || null,
      internalNotes: readText(formData, 'callNotes', 2000) || null,
    };

    await prisma.consultationCall.upsert({
      where: { orderId },
      update: data,
      create: { orderId, ...data },
    });

    await recordAudit({
      adminUserId: admin.id,
      action: 'order.call.update',
      entityType: 'ConsultationCall',
      entityId: orderId,
      before,
      after: data,
    });

    revalidatePath(`/admin/commandes/${orderId}`);
    return { ok: true, message: 'Appel conseil mis à jour.' };
  } catch (error) {
    return toActionState(error, "mise à jour de l'appel conseil");
  }
}

/** Réémission de l'email de commande (paiement en attente). */
export async function resendOrderEmailAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, simulation: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new OrderError('Commande introuvable.', 404);

    const { sendEmail } = await import('@/lib/email');
    const { buildOrderCreatedEmail } = await import('@/lib/email/templates');
    const { getCompanyContact, getReportDeliveryHours, getSettingString, SETTING_KEYS } =
      await import('@/lib/settings');
    const { getActivePaymentProvider } = await import('@/lib/payments/registry');
    const { formatSurface, formatXOF } = await import('@/lib/format');
    const { env } = await import('@/lib/env');

    const [company, deliveryHours, instructions] = await Promise.all([
      getCompanyContact(),
      getReportDeliveryHours(),
      getSettingString(SETTING_KEYS.PAYMENT_INSTRUCTIONS),
    ]);

    const result = await sendEmail(
      buildOrderCreatedEmail({
        customerFirstName: order.customer.firstName,
        customerEmail: order.customer.email,
        orderReference: order.reference,
        amount: order.amount,
        paymentLabel: getActivePaymentProvider().label,
        paymentInstructions: instructions,
        projectSummary: order.simulation
          ? `${order.simulation.projectTypeNameSnapshot} — ${formatSurface(order.simulation.surface)} — ${order.simulation.cityNameSnapshot} — estimation ${formatXOF(order.simulation.estimatedTotal)}`
          : 'Projet de construction',
        deliveryHours,
        companyName: company.name,
        companyEmail: company.email,
        orderUrl: `${env.siteUrl}/commande/${order.reference}`,
      }),
    );

    await recordAudit({
      adminUserId: admin.id,
      action: 'order.email.resend',
      entityType: 'Order',
      entityId: orderId,
      after: { delivered: result.delivered, provider: result.provider },
    });

    return {
      ok: true,
      message: result.delivered
        ? 'Email de commande renvoyé.'
        : `Email généré en mode « ${result.provider} » (aucun envoi réel).`,
    };
  } catch (error) {
    if (error instanceof PaymentError) return { ok: false, error: error.message };
    return toActionState(error, "renvoi de l'email de commande");
  }
}

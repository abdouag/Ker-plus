'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/guard';
import { assertCsrf } from '@/lib/security/csrf';
import { recordAudit } from '@/lib/audit';
import { reportContentSchema } from '@/lib/validation/schemas';
import {
  generateReportPdf,
  importReportPdf,
  issueDownloadToken,
  revokeDownloadToken,
  saveReportContent,
  sendReportToCustomer,
  ReportError,
} from '@/lib/services/reports';
import { env } from '@/lib/env';
import { readText, toActionState, type ActionState } from './shared';

/** Postes saisis dans le formulaire (répétés par index). */
function parseItems(formData: FormData) {
  const categories = formData.getAll('itemCategory').map(String);
  const labels = formData.getAll('itemLabel').map(String);
  const amounts = formData.getAll('itemAmount').map(String);
  const percentages = formData.getAll('itemPercentage').map(String);
  const descriptions = formData.getAll('itemDescription').map(String);

  return labels
    .map((label, index) => {
      const amountRaw = (amounts[index] ?? '').replace(/[^\d]/g, '');
      const percentageRaw = (percentages[index] ?? '').replace(',', '.').trim();
      const percentage = percentageRaw ? Math.round(Number(percentageRaw) * 100) : null;
      return {
        category: (categories[index] ?? '').trim(),
        label: label.trim(),
        amount: Number.parseInt(amountRaw || '0', 10),
        percentage: Number.isFinite(percentage as number) ? percentage : null,
        description: (descriptions[index] ?? '').trim(),
        displayOrder: index,
      };
    })
    .filter((item) => item.label.length > 0);
}

/** Enregistrement du contenu du rapport (postes, textes, validation). */
export async function saveReportAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    const parsed = reportContentSchema.safeParse({
      summary: readText(formData, 'summary'),
      assumptions: readText(formData, 'assumptions'),
      recommendations: readText(formData, 'recommendations'),
      exclusions: readText(formData, 'exclusions'),
      timeline: readText(formData, 'timeline', 4000),
      validatedBy: readText(formData, 'validatedBy', 160),
      items: parseItems(formData),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
    }

    await saveReportContent({
      orderId,
      adminUserId: admin.id,
      summary: parsed.data.summary || null,
      assumptions: parsed.data.assumptions || null,
      recommendations: parsed.data.recommendations || null,
      exclusions: parsed.data.exclusions || null,
      timeline: parsed.data.timeline || null,
      validatedBy: parsed.data.validatedBy || null,
      items: parsed.data.items.map((item) => ({
        category: item.category,
        label: item.label,
        amount: item.amount,
        percentage: item.percentage ?? null,
        description: item.description || null,
        displayOrder: item.displayOrder,
      })),
    });

    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/rapports');
    return { ok: true, message: 'Rapport enregistré.' };
  } catch (error) {
    return toActionState(error, 'enregistrement du rapport');
  }
}

/** Génère le PDF Kerplus à partir des données validées. */
export async function generateReportPdfAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    await generateReportPdf(orderId, admin.id);

    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/rapports');
    return { ok: true, message: 'PDF généré. Vous pouvez le prévisualiser puis l’envoyer.' };
  } catch (error) {
    return toActionState(error, 'génération du PDF');
  }
}

/** Import d'un PDF final préparé hors application. */
export async function importReportPdfAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'Sélectionnez un fichier PDF.' };
    }
    if (file.size > env.reports.maxUploadBytes) {
      const limitMb = Math.round(env.reports.maxUploadBytes / (1024 * 1024));
      return { ok: false, error: `Fichier trop volumineux (maximum ${limitMb} Mo).` };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await importReportPdf({
      orderId,
      adminUserId: admin.id,
      buffer,
      declaredType: file.type || undefined,
    });

    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/rapports');
    return { ok: true, message: 'PDF importé et marqué comme prêt.' };
  } catch (error) {
    return toActionState(error, 'import du PDF');
  }
}

/** Envoi (ou renvoi) du rapport au client avec un lien sécurisé neuf. */
export async function sendReportAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    const { expiresAt } = await sendReportToCustomer(orderId, admin.id);

    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/rapports');
    return {
      ok: true,
      message: `Rapport envoyé. Le lien de téléchargement expire le ${expiresAt.toLocaleDateString('fr-FR')}.`,
    };
  } catch (error) {
    return toActionState(error, 'envoi du rapport');
  }
}

/** Émet un nouveau lien de téléchargement sans envoyer d'email. */
export async function reissueDownloadLinkAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    const report = await prisma.report.findUnique({ where: { orderId } });
    if (!report?.fileKey) throw new ReportError('Aucun PDF associé à cette commande.', 400);

    const { token, expiresAt } = await issueDownloadToken(orderId);
    await recordAudit({
      adminUserId: admin.id,
      action: 'report.token.reissue',
      entityType: 'Report',
      entityId: report.id,
      after: { expiresAt },
    });

    revalidatePath(`/admin/commandes/${orderId}`);
    return {
      ok: true,
      // Le jeton n'est affiché qu'une fois, à l'administrateur authentifié.
      message: `Nouveau lien : ${env.siteUrl}/rapport/${token}`,
    };
  } catch (error) {
    return toActionState(error, 'émission du lien de téléchargement');
  }
}

/** Révocation immédiate du lien de téléchargement. */
export async function revokeDownloadLinkAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    await revokeDownloadToken(orderId, admin.id);

    revalidatePath(`/admin/commandes/${orderId}`);
    return { ok: true, message: 'Lien de téléchargement révoqué.' };
  } catch (error) {
    return toActionState(error, 'révocation du lien');
  }
}

/** Marque le rapport comme prêt sans l'envoyer. */
export async function markReportReadyAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const orderId = readText(formData, 'orderId', 64);

    const report = await prisma.report.findUnique({ where: { orderId } });
    if (!report?.fileKey) {
      throw new ReportError(
        'Générez ou importez un PDF avant de marquer le rapport comme prêt.',
        400,
      );
    }

    await prisma.report.update({
      where: { orderId },
      data: { status: 'READY', validatedAt: report.validatedAt ?? new Date() },
    });
    await prisma.order.updateMany({
      where: { id: orderId, status: { in: ['PAID', 'IN_PREPARATION'] } },
      data: { status: 'READY' },
    });

    await recordAudit({
      adminUserId: admin.id,
      action: 'report.ready',
      entityType: 'Report',
      entityId: report.id,
    });

    revalidatePath(`/admin/commandes/${orderId}`);
    revalidatePath('/admin/rapports');
    return { ok: true, message: 'Rapport marqué comme prêt.' };
  } catch (error) {
    return toActionState(error, 'validation du rapport');
  }
}

/** Aide à la saisie : montants suggérés à partir de l'estimation validée. */
export async function readReportItemsCount(orderId: string): Promise<number> {
  const report = await prisma.report.findUnique({
    where: { orderId },
    include: { items: true },
  });
  return report?.items.length ?? 0;
}

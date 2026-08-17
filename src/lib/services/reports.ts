import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Prisma, Report } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { recordAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { buildReportReadyEmail } from '@/lib/email/templates';
import { getCompanyContact, getSettingString, SETTING_KEYS } from '@/lib/settings';
import { buildReportPdf, type ReportPdfData } from '@/lib/pdf/report-pdf';

export class ReportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ReportError';
  }
}

const PDF_MAGIC = Buffer.from('%PDF-');

function storageRoot(): string {
  return resolve(process.cwd(), env.reports.storageDir);
}

/**
 * Résout un `fileKey` en chemin absolu en refusant toute traversée de
 * répertoire : seuls les noms de fichiers plats sont acceptés.
 */
function resolveStoredPath(fileKey: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(fileKey) || fileKey.includes('..')) {
    throw new ReportError('Référence de fichier invalide.', 400);
  }
  return join(storageRoot(), fileKey);
}

/** Vérifie qu'un fichier importé est bien un PDF et respecte la taille maximale. */
export function assertValidPdf(buffer: Buffer, declaredType?: string): void {
  if (buffer.byteLength === 0) {
    throw new ReportError('Fichier vide.', 400);
  }
  if (buffer.byteLength > env.reports.maxUploadBytes) {
    const limitMb = Math.round(env.reports.maxUploadBytes / (1024 * 1024));
    throw new ReportError(`Fichier trop volumineux (maximum ${limitMb} Mo).`, 413);
  }
  if (declaredType && declaredType !== 'application/pdf') {
    throw new ReportError('Seuls les fichiers PDF sont acceptés.', 415);
  }
  if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new ReportError('Le fichier fourni n’est pas un PDF valide.', 415);
  }
}

async function storePdf(
  orderReference: string,
  content: Buffer,
): Promise<{
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileChecksum: string;
}> {
  await mkdir(storageRoot(), { recursive: true });
  const fileKey = `${orderReference}-${randomBytes(8).toString('hex')}.pdf`;
  await writeFile(resolveStoredPath(fileKey), content, { mode: 0o640 });
  return {
    fileKey,
    fileName: `Rapport-Kerplus-${orderReference}.pdf`,
    fileSize: content.byteLength,
    fileChecksum: createHash('sha256').update(content).digest('hex'),
  };
}

async function removeStoredPdf(fileKey: string | null): Promise<void> {
  if (!fileKey) return;
  try {
    await unlink(resolveStoredPath(fileKey));
  } catch {
    // Fichier déjà absent : rien à faire.
  }
}

/** Enregistre le contenu rédigé par Kerplus (postes, textes, validation). */
export async function saveReportContent(input: {
  orderId: string;
  adminUserId: string;
  summary?: string | null;
  assumptions?: string | null;
  recommendations?: string | null;
  exclusions?: string | null;
  timeline?: string | null;
  validatedBy?: string | null;
  items: {
    category: string;
    label: string;
    amount: number;
    percentage?: number | null;
    description?: string | null;
    displayOrder: number;
  }[];
}): Promise<Report> {
  const before = await prisma.report.findUnique({
    where: { orderId: input.orderId },
    include: { items: true },
  });

  const report = await prisma.$transaction(async (tx) => {
    const saved = await tx.report.upsert({
      where: { orderId: input.orderId },
      update: {
        summary: input.summary ?? null,
        assumptions: input.assumptions ?? null,
        recommendations: input.recommendations ?? null,
        exclusions: input.exclusions ?? null,
        timeline: input.timeline ?? null,
        validatedBy: input.validatedBy ?? null,
        preparedById: input.adminUserId,
        status: 'IN_PREPARATION',
      },
      create: {
        orderId: input.orderId,
        summary: input.summary ?? null,
        assumptions: input.assumptions ?? null,
        recommendations: input.recommendations ?? null,
        exclusions: input.exclusions ?? null,
        timeline: input.timeline ?? null,
        validatedBy: input.validatedBy ?? null,
        preparedById: input.adminUserId,
        status: 'IN_PREPARATION',
      },
    });

    await tx.reportItem.deleteMany({ where: { reportId: saved.id } });
    if (input.items.length > 0) {
      await tx.reportItem.createMany({
        data: input.items.map((item, index) => ({
          reportId: saved.id,
          category: item.category,
          label: item.label,
          amount: item.amount,
          percentage: item.percentage ?? null,
          description: item.description || null,
          displayOrder: item.displayOrder || index,
        })),
      });
    }

    await tx.order.updateMany({
      where: { id: input.orderId, status: 'PAID' },
      data: { status: 'IN_PREPARATION' },
    });

    return saved;
  });

  await recordAudit({
    adminUserId: input.adminUserId,
    action: 'report.content.save',
    entityType: 'Report',
    entityId: report.id,
    before,
    after: { ...report, itemCount: input.items.length },
  });

  return report;
}

/** Rassemble les données nécessaires à la génération du PDF. */
async function collectPdfData(orderId: string): Promise<ReportPdfData> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      simulation: true,
      report: { include: { items: { orderBy: { displayOrder: 'asc' } } } },
    },
  });
  if (!order) throw new ReportError('Commande introuvable.', 404);
  if (!order.report) throw new ReportError('Aucun rapport à générer pour cette commande.', 400);

  const [company, disclaimer] = await Promise.all([
    getCompanyContact(),
    getSettingString(
      SETTING_KEYS.DISCLAIMER_TEXT,
      'Ce document est une aide à la décision. Il ne constitue ni un devis contractuel ni une étude technique.',
    ),
  ]);

  return {
    orderReference: order.reference,
    simulationReference: order.simulation?.reference ?? null,
    customer: {
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
      email: order.customer.email,
      phone: order.customer.phone,
      city: order.customer.city,
    },
    project: order.simulation
      ? {
          type: order.simulation.projectTypeNameSnapshot,
          surface: order.simulation.surface,
          city: order.simulation.cityNameSnapshot,
          finish: order.simulation.finishNameSnapshot,
          pricePerSquareMeter: order.simulation.pricePerSquareMeterSnapshot,
          projectCoefficient: order.simulation.projectCoefficientSnapshot,
          cityCoefficient: order.simulation.cityCoefficientSnapshot,
          estimatedTotal: order.simulation.estimatedTotal,
          estimatedMinimum: order.simulation.estimatedMinimum,
          estimatedMaximum: order.simulation.estimatedMaximum,
          desiredStartDate: order.desiredStartDate,
          comment: order.customerComment,
        }
      : null,
    content: {
      summary: order.report.summary,
      assumptions: order.report.assumptions,
      recommendations: order.report.recommendations,
      exclusions: order.report.exclusions,
      timeline: order.report.timeline,
    },
    items: order.report.items.map((item) => ({
      category: item.category,
      label: item.label,
      amount: item.amount,
      percentage: item.percentage,
      description: item.description,
    })),
    disclaimer,
    preparedAt: new Date(),
    validatedBy: order.report.validatedBy ?? '',
    companyName: company.name,
    companyEmail: company.email,
  };
}

/** Génère le PDF Kerplus à partir des données validées et le stocke. */
export async function generateReportPdf(orderId: string, adminUserId: string): Promise<Report> {
  const data = await collectPdfData(orderId);
  if (data.items.length === 0 && !data.content.summary) {
    throw new ReportError(
      'Renseignez au minimum une synthèse ou des postes avant de générer le PDF.',
      400,
    );
  }

  const bytes = await buildReportPdf(data);
  const buffer = Buffer.from(bytes);
  const existing = await prisma.report.findUnique({ where: { orderId } });
  const stored = await storePdf(data.orderReference, buffer);
  await removeStoredPdf(existing?.fileKey ?? null);

  const report = await prisma.report.update({
    where: { orderId },
    data: {
      ...stored,
      status: 'READY',
      preparedById: adminUserId,
      validatedAt: new Date(),
    },
  });

  await prisma.order.updateMany({
    where: { id: orderId, status: { in: ['PAID', 'IN_PREPARATION'] } },
    data: { status: 'READY' },
  });

  await recordAudit({
    adminUserId,
    action: 'report.pdf.generate',
    entityType: 'Report',
    entityId: report.id,
    after: { fileKey: report.fileKey, fileSize: report.fileSize },
  });

  return report;
}

/** Import direct d'un PDF final préparé hors application. */
export async function importReportPdf(input: {
  orderId: string;
  adminUserId: string;
  buffer: Buffer;
  declaredType?: string;
}): Promise<Report> {
  assertValidPdf(input.buffer, input.declaredType);

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { reference: true },
  });
  if (!order) throw new ReportError('Commande introuvable.', 404);

  const existing = await prisma.report.findUnique({ where: { orderId: input.orderId } });
  const stored = await storePdf(order.reference, input.buffer);
  await removeStoredPdf(existing?.fileKey ?? null);

  const report = await prisma.report.upsert({
    where: { orderId: input.orderId },
    update: {
      ...stored,
      status: 'READY',
      preparedById: input.adminUserId,
      validatedAt: new Date(),
    },
    create: {
      orderId: input.orderId,
      ...stored,
      status: 'READY',
      preparedById: input.adminUserId,
      validatedAt: new Date(),
    },
  });

  await prisma.order.updateMany({
    where: { id: input.orderId, status: { in: ['PAID', 'IN_PREPARATION'] } },
    data: { status: 'READY' },
  });

  await recordAudit({
    adminUserId: input.adminUserId,
    action: 'report.pdf.import',
    entityType: 'Report',
    entityId: report.id,
    after: { fileKey: report.fileKey, fileSize: report.fileSize },
  });

  return report;
}

export function hashDownloadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Émet un lien de téléchargement : jeton aléatoire de 32 octets, jamais
 * persisté en clair, expirable et révocable.
 */
export async function issueDownloadToken(
  orderId: string,
  ttlHours = env.reports.downloadTtlHours,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
  await prisma.report.update({
    where: { orderId },
    data: { secureTokenHash: hashDownloadToken(token), tokenExpiresAt: expiresAt },
  });
  return { token, expiresAt };
}

/** Révoque immédiatement le lien de téléchargement en cours. */
export async function revokeDownloadToken(orderId: string, adminUserId: string): Promise<void> {
  await prisma.report.update({
    where: { orderId },
    data: { secureTokenHash: null, tokenExpiresAt: null },
  });
  await recordAudit({
    adminUserId,
    action: 'report.token.revoke',
    entityType: 'Report',
    entityId: orderId,
  });
}

export interface ResolvedDownload {
  fileName: string;
  content: Buffer;
}

/**
 * Résout un jeton de téléchargement.
 * Retourne `null` pour tout jeton inconnu, expiré ou révoqué — sans divulguer
 * la raison exacte de l'échec.
 */
export async function resolveDownload(token: string): Promise<ResolvedDownload | null> {
  if (!token || token.length < 20) return null;
  const report = await prisma.report.findUnique({
    where: { secureTokenHash: hashDownloadToken(token) },
  });
  if (!report || !report.fileKey) return null;
  if (!report.tokenExpiresAt || report.tokenExpiresAt.getTime() < Date.now()) return null;
  if (report.status !== 'READY' && report.status !== 'SENT') return null;

  let content: Buffer;
  try {
    content = await readFile(resolveStoredPath(report.fileKey));
  } catch {
    console.error('[reports] fichier introuvable sur le disque', { reportId: report.id });
    return null;
  }

  await prisma.report.update({
    where: { id: report.id },
    data: { downloadedAt: new Date(), downloadCount: { increment: 1 } },
  });

  return { fileName: report.fileName ?? 'rapport-kerplus.pdf', content };
}

/** Lecture du PDF pour prévisualisation par un administrateur authentifié. */
export async function readReportFile(orderId: string): Promise<ResolvedDownload | null> {
  const report = await prisma.report.findUnique({ where: { orderId } });
  if (!report?.fileKey) return null;
  try {
    const content = await readFile(resolveStoredPath(report.fileKey));
    return { fileName: report.fileName ?? 'rapport-kerplus.pdf', content };
  } catch {
    return null;
  }
}

/** Envoie (ou renvoie) le rapport au client avec un lien sécurisé neuf. */
export async function sendReportToCustomer(
  orderId: string,
  adminUserId: string,
): Promise<{ downloadUrl: string; expiresAt: Date }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, report: true },
  });
  if (!order) throw new ReportError('Commande introuvable.', 404);
  if (!order.report?.fileKey) {
    throw new ReportError('Aucun PDF n’est associé à cette commande.', 400);
  }
  if (order.status !== 'READY' && order.status !== 'DELIVERED') {
    throw new ReportError('Le rapport doit être marqué comme prêt avant envoi.', 409);
  }

  const { token, expiresAt } = await issueDownloadToken(orderId);
  const downloadUrl = `${env.siteUrl}/rapport/${token}`;
  const company = await getCompanyContact();

  await sendEmail(
    buildReportReadyEmail({
      customerFirstName: order.customer.firstName,
      customerEmail: order.customer.email,
      orderReference: order.reference,
      downloadUrl,
      expiresAt,
      companyName: company.name,
      companyEmail: company.email,
    }),
  );

  const now = new Date();
  await prisma.$transaction([
    prisma.report.update({ where: { orderId }, data: { status: 'SENT', sentAt: now } }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'DELIVERED', deliveredAt: now },
    }),
  ]);

  await recordAudit({
    adminUserId,
    action: 'report.send',
    entityType: 'Report',
    entityId: order.report.id,
    after: { sentAt: now, expiresAt },
  });

  return { downloadUrl, expiresAt };
}

/** Somme des postes saisis — utilisée pour le contrôle de cohérence. */
export function sumReportItems(items: { amount: number }[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}

export type ReportWithItems = Prisma.ReportGetPayload<{ include: { items: true } }>;

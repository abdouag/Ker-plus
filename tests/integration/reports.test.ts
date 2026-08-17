import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createOrder } from '@/lib/services/orders';
import { confirmPaymentManually } from '@/lib/services/payments';
import {
  assertValidPdf,
  generateReportPdf,
  importReportPdf,
  issueDownloadToken,
  readReportFile,
  resolveDownload,
  revokeDownloadToken,
  saveReportContent,
  sendReportToCustomer,
  sumReportItems,
  ReportError,
} from '@/lib/services/reports';
import { createOrderSchema } from '@/lib/validation/schemas';
import {
  orderPayload,
  prisma,
  resetDatabase,
  seedReferentials,
  type SeededReferentials,
} from './helpers';

let referentials: SeededReferentials;

beforeEach(async () => {
  await resetDatabase();
  referentials = await seedReferentials();
  process.env.PAYMENT_PROVIDER = 'wave_link';
  process.env.WAVE_PAYMENT_URL = 'https://wave.com/pay/kerplus';
});

afterAll(async () => {
  await prisma.$disconnect();
  await rm(resolve(process.cwd(), 'storage/test-reports'), { recursive: true, force: true });
});

/** Commande payée, prête pour la préparation du rapport. */
async function paidOrder() {
  const { order, payment } = await createOrder(createOrderSchema.parse(orderPayload(referentials)));
  await confirmPaymentManually({
    paymentId: payment.id,
    adminUserId: referentials.adminId,
    externalReference: 'WAVE-TX-OK',
  });
  return order;
}

const ITEMS = [
  {
    category: 'Gros œuvre',
    label: 'Fondations',
    amount: 5_445_000,
    percentage: 1500,
    displayOrder: 0,
  },
  {
    category: 'Gros œuvre',
    label: 'Élévation',
    amount: 10_890_000,
    percentage: 3000,
    displayOrder: 1,
  },
  {
    category: 'Second œuvre',
    label: 'Électricité',
    amount: 2_178_000,
    percentage: 600,
    displayOrder: 2,
  },
  {
    category: 'Main-d’œuvre',
    label: 'Main-d’œuvre',
    amount: 7_260_000,
    percentage: 2000,
    displayOrder: 3,
  },
];

describe('préparation du rapport', () => {
  it('enregistre les postes et bascule la commande en préparation', async () => {
    const order = await paidOrder();

    await saveReportContent({
      orderId: order.id,
      adminUserId: referentials.adminId,
      summary: 'Projet cohérent avec le budget annoncé.',
      assumptions: 'Terrain viabilisé et accessible.',
      recommendations: 'Prévoir une étude de sol avant exécution.',
      exclusions: 'Terrain, honoraires, raccordements.',
      timeline: 'Environ 10 mois de chantier.',
      validatedBy: 'Ing. Kerplus',
      items: ITEMS,
    });

    const report = await prisma.report.findUniqueOrThrow({
      where: { orderId: order.id },
      include: { items: true },
    });
    expect(report.status).toBe('IN_PREPARATION');
    expect(report.items).toHaveLength(4);
    expect(report.validatedBy).toBe('Ing. Kerplus');
    expect(sumReportItems(report.items)).toBe(25_773_000);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('IN_PREPARATION');
  });

  it('remplace les postes à chaque enregistrement, sans doublon', async () => {
    const order = await paidOrder();
    await saveReportContent({
      orderId: order.id,
      adminUserId: referentials.adminId,
      items: ITEMS,
    });
    await saveReportContent({
      orderId: order.id,
      adminUserId: referentials.adminId,
      items: [ITEMS[0]],
    });

    const report = await prisma.report.findUniqueOrThrow({
      where: { orderId: order.id },
      include: { items: true },
    });
    expect(report.items).toHaveLength(1);
  });
});

describe('génération et import du PDF', () => {
  it('génère un PDF Kerplus exploitable', async () => {
    const order = await paidOrder();
    await saveReportContent({
      orderId: order.id,
      adminUserId: referentials.adminId,
      summary: 'Synthèse détaillée du projet — accents é, è, à, ç, ù et caractères « spéciaux ».',
      assumptions: 'Hypothèses retenues.',
      recommendations: 'Recommandations techniques.',
      exclusions: 'Exclusions.',
      timeline: 'Délais estimatifs.',
      validatedBy: 'Ing. Kerplus',
      items: ITEMS,
    });

    const report = await generateReportPdf(order.id, referentials.adminId);
    expect(report.status).toBe('READY');
    expect(report.fileKey).toMatch(/\.pdf$/);
    expect(report.fileSize).toBeGreaterThan(1_000);
    expect(report.fileChecksum).toHaveLength(64);

    const file = await readReportFile(order.id);
    expect(file?.content.subarray(0, 5).toString()).toBe('%PDF-');

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('READY');
  });

  it('refuse de générer un PDF vide', async () => {
    const order = await paidOrder();
    await expect(generateReportPdf(order.id, referentials.adminId)).rejects.toBeInstanceOf(
      ReportError,
    );
  });

  it('importe un PDF fourni par l’équipe', async () => {
    const order = await paidOrder();
    const pdf = Buffer.from('%PDF-1.7\n%rapport de test\n%%EOF\n');

    const report = await importReportPdf({
      orderId: order.id,
      adminUserId: referentials.adminId,
      buffer: pdf,
      declaredType: 'application/pdf',
    });

    expect(report.status).toBe('READY');
    const file = await readReportFile(order.id);
    expect(file?.content.equals(pdf)).toBe(true);
  });

  it('refuse un fichier qui n’est pas un PDF', () => {
    expect(() => assertValidPdf(Buffer.from('<html>pas un pdf</html>'))).toThrow(ReportError);
    expect(() => assertValidPdf(Buffer.alloc(0))).toThrow(ReportError);
    expect(() => assertValidPdf(Buffer.from('%PDF-1.7'), 'image/png')).toThrow(
      /Seuls les fichiers PDF/,
    );
  });

  it('refuse un fichier trop volumineux', () => {
    process.env.REPORT_MAX_UPLOAD_BYTES = '100';
    expect(() => assertValidPdf(Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(200)]))).toThrow(
      /trop volumineux/,
    );
    delete process.env.REPORT_MAX_UPLOAD_BYTES;
  });
});

describe('lien de téléchargement sécurisé', () => {
  async function readyOrder() {
    const order = await paidOrder();
    await importReportPdf({
      orderId: order.id,
      adminUserId: referentials.adminId,
      buffer: Buffer.from('%PDF-1.7\ncontenu\n%%EOF\n'),
      declaredType: 'application/pdf',
    });
    return order;
  }

  it('n’est jamais stocké en clair et permet un téléchargement unique par jeton', async () => {
    const order = await readyOrder();
    const { token } = await issueDownloadToken(order.id);

    const stored = await prisma.report.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(stored.secureTokenHash).not.toBe(token);
    expect(stored.secureTokenHash).toHaveLength(64);
    expect(token.length).toBeGreaterThan(30);

    const download = await resolveDownload(token);
    expect(download?.content.subarray(0, 5).toString()).toBe('%PDF-');

    const after = await prisma.report.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(after.downloadCount).toBe(1);
    expect(after.downloadedAt).not.toBeNull();
  });

  it('rejette un jeton inconnu, expiré ou révoqué', async () => {
    const order = await readyOrder();
    const { token } = await issueDownloadToken(order.id);

    expect(await resolveDownload('jeton-inexistant-mais-assez-long-1234')).toBeNull();
    expect(await resolveDownload('court')).toBeNull();

    await prisma.report.update({
      where: { orderId: order.id },
      data: { tokenExpiresAt: new Date(Date.now() - 1000) },
    });
    expect(await resolveDownload(token)).toBeNull();

    await prisma.report.update({
      where: { orderId: order.id },
      data: { tokenExpiresAt: new Date(Date.now() + 3_600_000) },
    });
    expect(await resolveDownload(token)).not.toBeNull();

    await revokeDownloadToken(order.id, referentials.adminId);
    expect(await resolveDownload(token)).toBeNull();
  });

  it('envoie le rapport et marque la commande comme livrée', async () => {
    const order = await readyOrder();
    const { downloadUrl, expiresAt } = await sendReportToCustomer(order.id, referentials.adminId);

    expect(downloadUrl).toContain('/rapport/');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const report = await prisma.report.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(report.status).toBe('SENT');
    expect(report.sentAt).not.toBeNull();

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('DELIVERED');
    expect(updatedOrder.deliveredAt).not.toBeNull();

    const token = downloadUrl.split('/rapport/')[1];
    expect(await resolveDownload(token)).not.toBeNull();
  });

  it('refuse l’envoi sans PDF associé', async () => {
    const order = await paidOrder();
    await expect(sendReportToCustomer(order.id, referentials.adminId)).rejects.toThrow(/Aucun PDF/);
  });

  it('renouvelle le lien à chaque envoi et invalide le précédent', async () => {
    const order = await readyOrder();
    const first = await sendReportToCustomer(order.id, referentials.adminId);
    const second = await sendReportToCustomer(order.id, referentials.adminId);

    expect(first.downloadUrl).not.toBe(second.downloadUrl);
    expect(await resolveDownload(first.downloadUrl.split('/rapport/')[1])).toBeNull();
    expect(await resolveDownload(second.downloadUrl.split('/rapport/')[1])).not.toBeNull();
  });
});

import 'server-only';

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { formatDate, formatSurface, formatXOF } from '@/lib/format';
import { fromCoefficientInt } from '@/lib/estimation/constants';

/**
 * Génération du PDF Kerplus à partir des données saisies et validées par
 * l'équipe. Aucun contenu technique n'est inventé : le document ne restitue
 * que ce qui a été renseigné dans l'administration.
 */

const FOREST = rgb(0.102, 0.302, 0.18); // #1A4D2E
const EMBER = rgb(1, 0.549, 0.259); // #FF8C42
const INK = rgb(0.106, 0.106, 0.106);
const MUTED = rgb(0.42, 0.42, 0.42);
const SAND = rgb(0.961, 0.937, 0.902); // #F5EFE6

const PAGE_WIDTH = 595.28; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Les polices standard PDF utilisent l'encodage WinAnsi : on remplace les
 * caractères non représentables (espaces fines, guillemets typographiques
 * exotiques…) pour éviter tout échec de génération.
 */
export function sanitizeForPdf(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00A0\u2007\u2009\u202F]/g, ' ')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/\u20AC/g, 'EUR')
    .replace(/[^\n\u0020-\u00FF]/g, '');
}

export interface ReportPdfData {
  orderReference: string;
  simulationReference: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string | null;
  };
  project: {
    type: string;
    surface: number;
    city: string;
    finish: string;
    pricePerSquareMeter: number;
    projectCoefficient: number;
    cityCoefficient: number;
    estimatedTotal: number;
    estimatedMinimum: number;
    estimatedMaximum: number;
    desiredStartDate: Date | null;
    comment: string | null;
  } | null;
  content: {
    summary: string | null;
    assumptions: string | null;
    recommendations: string | null;
    exclusions: string | null;
    timeline: string | null;
  };
  items: {
    category: string;
    label: string;
    amount: number;
    percentage: number | null;
    description: string | null;
  }[];
  disclaimer: string;
  preparedAt: Date;
  validatedBy: string;
  companyName: string;
  companyEmail: string;
}

interface Cursor {
  page: PDFPage;
  y: number;
  pageIndex: number;
}

class PdfBuilder {
  private cursor: Cursor;

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
  ) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursor = { page, y: PAGE_HEIGHT - MARGIN, pageIndex: 0 };
  }

  get page(): PDFPage {
    return this.cursor.page;
  }

  get y(): number {
    return this.cursor.y;
  }

  set y(value: number) {
    this.cursor.y = value;
  }

  ensureSpace(height: number): void {
    if (this.cursor.y - height >= MARGIN + 40) return;
    const page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursor = { page, y: PAGE_HEIGHT - MARGIN, pageIndex: this.cursor.pageIndex + 1 };
  }

  wrap(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
    const clean = sanitizeForPdf(text);
    const lines: string[] = [];
    clean.split('\n').forEach((paragraph) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push('');
        return;
      }
      let current = '';
      words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      });
      if (current) lines.push(current);
    });
    return lines;
  }

  text(
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      maxWidth?: number;
      lineGap?: number;
    } = {},
  ): void {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.regular;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
    const lineHeight = size + (options.lineGap ?? 4);
    this.wrap(value, size, font, maxWidth).forEach((line) => {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: options.x ?? MARGIN,
        y: this.y - size,
        size,
        font,
        color: options.color ?? INK,
      });
      this.y -= lineHeight;
    });
  }

  heading(value: string): void {
    this.ensureSpace(40);
    this.y -= 10;
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 18,
      width: 4,
      height: 18,
      color: EMBER,
    });
    this.page.drawText(sanitizeForPdf(value.toUpperCase()), {
      x: MARGIN + 12,
      y: this.y - 14,
      size: 12,
      font: this.bold,
      color: FOREST,
    });
    this.y -= 28;
  }

  keyValue(label: string, value: string): void {
    this.ensureSpace(16);
    this.page.drawText(sanitizeForPdf(label), {
      x: MARGIN,
      y: this.y - 10,
      size: 9,
      font: this.regular,
      color: MUTED,
    });
    const lines = this.wrap(value, 10, this.bold, CONTENT_WIDTH - 170);
    lines.forEach((line, index) => {
      if (index > 0) this.ensureSpace(14);
      this.page.drawText(line, {
        x: MARGIN + 170,
        y: this.y - 10,
        size: 10,
        font: this.bold,
        color: INK,
      });
      if (index < lines.length - 1) this.y -= 14;
    });
    this.y -= 18;
  }

  spacer(height = 8): void {
    this.y -= height;
  }

  divider(): void {
    this.ensureSpace(12);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.6,
      color: rgb(0.85, 0.83, 0.8),
    });
    this.y -= 12;
  }

  banner(title: string, subtitle: string): void {
    this.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 110,
      width: PAGE_WIDTH,
      height: 110,
      color: FOREST,
    });
    this.page.drawText(sanitizeForPdf(title), {
      x: MARGIN,
      y: PAGE_HEIGHT - 58,
      size: 20,
      font: this.bold,
      color: rgb(1, 1, 1),
    });
    this.page.drawText(sanitizeForPdf(subtitle), {
      x: MARGIN,
      y: PAGE_HEIGHT - 80,
      size: 10,
      font: this.regular,
      color: rgb(0.85, 0.9, 0.86),
    });
    this.y = PAGE_HEIGHT - 130;
  }

  highlight(lines: { label: string; value: string; strong?: boolean }[]): void {
    const height = lines.length * 22 + 16;
    this.ensureSpace(height + 10);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - height,
      width: CONTENT_WIDTH,
      height,
      color: SAND,
    });
    let offset = this.y - 24;
    lines.forEach((line) => {
      this.page.drawText(sanitizeForPdf(line.label), {
        x: MARGIN + 14,
        y: offset,
        size: 10,
        font: this.regular,
        color: MUTED,
      });
      this.page.drawText(sanitizeForPdf(line.value), {
        x: MARGIN + 200,
        y: offset,
        size: line.strong ? 13 : 10,
        font: this.bold,
        color: line.strong ? FOREST : INK,
      });
      offset -= 22;
    });
    this.y -= height + 12;
  }

  tableHeader(columns: [string, string, string]): void {
    this.ensureSpace(24);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 18,
      width: CONTENT_WIDTH,
      height: 18,
      color: FOREST,
    });
    const xs = [MARGIN + 8, MARGIN + CONTENT_WIDTH - 190, MARGIN + CONTENT_WIDTH - 70];
    columns.forEach((column, index) => {
      this.page.drawText(sanitizeForPdf(column), {
        x: xs[index],
        y: this.y - 13,
        size: 9,
        font: this.bold,
        color: rgb(1, 1, 1),
      });
    });
    this.y -= 24;
  }

  tableRow(label: string, amount: string, percentage: string, description?: string | null): void {
    this.ensureSpace(description ? 30 : 18);
    const labelLines = this.wrap(label, 10, this.regular, CONTENT_WIDTH - 210);
    this.page.drawText(labelLines[0] ?? '', {
      x: MARGIN + 8,
      y: this.y - 10,
      size: 10,
      font: this.regular,
      color: INK,
    });
    this.page.drawText(sanitizeForPdf(amount), {
      x: MARGIN + CONTENT_WIDTH - 190,
      y: this.y - 10,
      size: 10,
      font: this.bold,
      color: INK,
    });
    this.page.drawText(sanitizeForPdf(percentage), {
      x: MARGIN + CONTENT_WIDTH - 70,
      y: this.y - 10,
      size: 10,
      font: this.regular,
      color: MUTED,
    });
    this.y -= 16;
    labelLines.slice(1).forEach((line) => {
      this.ensureSpace(12);
      this.page.drawText(line, {
        x: MARGIN + 8,
        y: this.y - 8,
        size: 10,
        font: this.regular,
        color: INK,
      });
      this.y -= 12;
    });
    if (description) {
      this.text(description, {
        size: 8.5,
        color: MUTED,
        x: MARGIN + 8,
        maxWidth: CONTENT_WIDTH - 40,
      });
    }
    this.divider();
  }

  finalize(companyName: string, orderReference: string): void {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawText(
        sanitizeForPdf(
          `${companyName} — Rapport ${orderReference} — page ${index + 1}/${pages.length}`,
        ),
        {
          x: MARGIN,
          y: 24,
          size: 8,
          font: this.regular,
          color: MUTED,
        },
      );
    });
  }
}

/** Construit le PDF et retourne son contenu binaire. */
export async function buildReportPdf(data: ReportPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Rapport technique ${data.orderReference}`);
  doc.setAuthor(data.companyName);
  doc.setSubject('Rapport technique détaillé — estimation de construction');
  doc.setProducer(data.companyName);
  doc.setCreationDate(data.preparedAt);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const builder = new PdfBuilder(doc, regular, bold);

  builder.banner(
    `${data.companyName} — Rapport technique détaillé`,
    `Commande ${data.orderReference}${data.simulationReference ? ` — Simulation ${data.simulationReference}` : ''}`,
  );

  builder.heading('Identité du client');
  builder.keyValue('Nom et prénom', `${data.customer.firstName} ${data.customer.lastName}`);
  builder.keyValue('Email', data.customer.email);
  builder.keyValue('Téléphone', data.customer.phone);
  if (data.customer.city) builder.keyValue('Ville du projet', data.customer.city);

  if (data.project) {
    builder.heading('Informations du projet');
    builder.keyValue('Type de projet', data.project.type);
    builder.keyValue('Surface construite totale', formatSurface(data.project.surface));
    builder.keyValue('Ville ou zone', data.project.city);
    builder.keyValue('Niveau de finition', data.project.finish);
    builder.keyValue('Prix au m² retenu', formatXOF(data.project.pricePerSquareMeter));
    builder.keyValue(
      'Coefficients appliqués',
      `Projet ${fromCoefficientInt(data.project.projectCoefficient).toFixed(2).replace('.', ',')} — Localisation ${fromCoefficientInt(data.project.cityCoefficient).toFixed(2).replace('.', ',')}`,
    );
    if (data.project.desiredStartDate) {
      builder.keyValue('Démarrage souhaité', formatDate(data.project.desiredStartDate));
    }
    if (data.project.comment) {
      builder.keyValue('Commentaire du client', data.project.comment);
    }

    builder.heading('Estimation globale');
    builder.highlight([
      {
        label: 'Estimation indicative',
        value: formatXOF(data.project.estimatedTotal),
        strong: true,
      },
      { label: 'Fourchette basse', value: formatXOF(data.project.estimatedMinimum) },
      { label: 'Fourchette haute', value: formatXOF(data.project.estimatedMaximum) },
    ]);
  }

  if (data.content.summary) {
    builder.heading('Synthèse');
    builder.text(data.content.summary);
  }

  if (data.content.assumptions) {
    builder.heading('Hypothèses retenues');
    builder.text(data.content.assumptions);
  }

  if (data.items.length > 0) {
    builder.heading('Répartition par poste');
    builder.tableHeader(['Poste', 'Montant', 'Part']);
    let previousCategory = '';
    data.items.forEach((item) => {
      if (item.category !== previousCategory) {
        builder.text(item.category, { size: 10, bold: true, color: FOREST });
        previousCategory = item.category;
      }
      builder.tableRow(
        item.label,
        formatXOF(item.amount),
        item.percentage !== null
          ? `${(item.percentage / 100).toFixed(1).replace('.', ',')} %`
          : '—',
        item.description,
      );
    });
    const total = data.items.reduce((sum, item) => sum + item.amount, 0);
    builder.highlight([{ label: 'Total des postes', value: formatXOF(total), strong: true }]);
  }

  if (data.content.timeline) {
    builder.heading('Délais estimatifs');
    builder.text(data.content.timeline);
  }

  if (data.content.recommendations) {
    builder.heading('Recommandations techniques');
    builder.text(data.content.recommendations);
  }

  if (data.content.exclusions) {
    builder.heading('Exclusions');
    builder.text(data.content.exclusions);
  }

  builder.heading('Avertissement légal');
  builder.text(data.disclaimer, { size: 9, color: MUTED });

  builder.spacer(6);
  builder.divider();
  builder.keyValue('Date de préparation', formatDate(data.preparedAt));
  builder.keyValue('Rapport validé par', data.validatedBy || '[À COMPLÉTER]');
  if (data.companyEmail) builder.keyValue('Contact', data.companyEmail);

  builder.finalize(data.companyName, data.orderReference);

  return doc.save();
}

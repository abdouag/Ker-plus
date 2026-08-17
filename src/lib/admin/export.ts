import 'server-only';

import ExcelJS from 'exceljs';

/** Colonne d'export : en-tête lisible + extracteur de valeur. */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null;
  width?: number;
}

/**
 * CSV compatible Excel francophone : séparateur point-virgule et BOM UTF-8
 * pour que les accents s'affichent correctement.
 */
export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): Buffer {
  const escape = (value: string | number | null): string => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    columns.map((column) => escape(column.header)).join(';'),
    ...rows.map((row) => columns.map((column) => escape(column.value(row))).join(';')),
  ];

  return Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from(lines.join('\r\n'), 'utf8')]);
}

/** Classeur Excel monofeuille, en-têtes figées et mises en forme. */
export async function toXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Estimateur Kerplus';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.header,
    width: column.width ?? Math.min(40, Math.max(14, column.header.length + 4)),
  }));

  rows.forEach((row) => {
    sheet.addRow(columns.map((column) => column.value(row)));
  });

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function exportFileName(entity: string, format: 'csv' | 'xlsx'): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `kerplus-${entity}-${stamp}.${format}`;
}

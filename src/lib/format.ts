import { CURRENCY_LABEL } from './estimation/constants';

export const TIMEZONE = 'Africa/Dakar';
export const LOCALE = 'fr-FR';

/** Espace insécable étroit utilisé comme séparateur de milliers en français. */
const NARROW_NBSP = ' ';

/**
 * Formate un montant entier en FCFA selon la convention française :
 * « 36 300 000 FCFA ». Les séparateurs sont normalisés afin que le rendu soit
 * identique quelle que soit la version d'ICU installée.
 */
export function formatXOF(amount: number, options: { withCurrency?: boolean } = {}): string {
  const { withCurrency = true } = options;
  const rounded = Math.round(amount);
  const absolute = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
  const sign = rounded < 0 ? '-' : '';
  const value = `${sign}${absolute}`;
  return withCurrency ? `${value}${NARROW_NBSP}${CURRENCY_LABEL}` : value;
}

/** Version compacte pour les tableaux de bord : « 36,3 M FCFA ». */
export function formatXOFCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${millions.toFixed(millions >= 100 ? 0 : 1).replace('.', ',')}${NARROW_NBSP}M${NARROW_NBSP}${CURRENCY_LABEL}`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${Math.round(amount / 1_000)}${NARROW_NBSP}k${NARROW_NBSP}${CURRENCY_LABEL}`;
  }
  return formatXOF(amount);
}

/** Formate un nombre décimal (coefficient) : 1,10. */
export function formatDecimal(value: number, fractionDigits = 2): string {
  return value.toFixed(fractionDigits).replace('.', ',');
}

/** Formate un pourcentage entier ×100 : 1000 -> « 10 % ». */
export function formatPercentage(percentageInt: number): string {
  const value = percentageInt / 100;
  const text = Number.isInteger(value) ? String(value) : formatDecimal(value, 2);
  return `${text}${NARROW_NBSP}%`;
}

/** Date longue en français, fuseau Africa/Dakar. */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'long',
    timeZone: TIMEZONE,
  }).format(value);
}

/** Date + heure en français, fuseau Africa/Dakar. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: TIMEZONE,
  }).format(value);
}

/** Format court AAAA-MM-JJ dans le fuseau de Dakar (exports CSV). */
export function formatDateISO(date: Date | string | null | undefined): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(value);
}

/** Surface : « 150 m² ». */
export function formatSurface(surface: number): string {
  return `${surface}${NARROW_NBSP}m²`;
}

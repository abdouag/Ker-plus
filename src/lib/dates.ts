import { TIMEZONE } from './format';

/**
 * Bornes temporelles exprimées dans le fuseau Africa/Dakar.
 * Ce fuseau est à UTC+00:00 toute l'année (aucun changement d'heure) : les
 * bornes locales coïncident donc exactement avec les bornes UTC.
 */

function dakarParts(date: Date): { year: number; month: number; day: number } {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE })
    .format(date)
    .split('-')
    .map(Number);
  return { year, month, day };
}

export function startOfDay(date: Date = new Date()): Date {
  const { year, month, day } = dakarParts(date);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function startOfMonth(date: Date = new Date()): Date {
  const { year, month } = dakarParts(date);
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

export function daysAgo(days: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - days * 24 * 3600 * 1000);
}

/** Taux de conversion en pourcentage arrondi à une décimale. */
export function conversionRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

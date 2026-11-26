import type { MaintenanceStatus } from '@prisma/client';

/**
 * Échéances de maintenance préventive — fonctions pures.
 *
 * Les fréquences sont indicatives (paramétrables par type d'équipement et
 * modifiables pour chaque équipement selon le fabricant ou le technicien).
 */

/** Ajoute un nombre de mois en restant sur le dernier jour valide du mois. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * Prochaine échéance d'un équipement : dernier entretien (ou installation)
 * + fréquence ; sans date de référence, à partir d'aujourd'hui.
 */
export function computeNextDue(
  frequencyMonths: number | null | undefined,
  reference: { lastServiceAt?: Date | null; installedAt?: Date | null },
  now: Date = new Date(),
): Date | null {
  if (!frequencyMonths || frequencyMonths <= 0) return null;
  const base = reference.lastServiceAt ?? reference.installedAt ?? now;
  return addMonths(base, frequencyMonths);
}

export type TaskBucket = 'overdue' | 'upcoming' | 'planned' | 'done' | 'cancelled';

export const TASK_BUCKET_LABELS: Record<TaskBucket, string> = {
  overdue: 'En retard',
  upcoming: 'À prévoir',
  planned: 'Planifiés',
  done: 'Effectués',
  cancelled: 'Annulés',
};

export function taskBucket(
  task: { status: MaintenanceStatus; dueAt: Date },
  now: Date = new Date(),
): TaskBucket {
  if (task.status === 'DONE') return 'done';
  if (task.status === 'CANCELLED') return 'cancelled';
  if (task.status === 'PLANNED') return 'planned';
  return task.dueAt.getTime() < now.getTime() ? 'overdue' : 'upcoming';
}

/** Rappel affiché dans l'interface : échéance dans les N prochains jours. */
export function isDueSoon(dueAt: Date, withinDays = 30, now: Date = new Date()): boolean {
  const diff = dueAt.getTime() - now.getTime();
  return diff <= withinDays * 24 * 3600 * 1000;
}

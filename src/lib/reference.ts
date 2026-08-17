import { randomInt } from 'node:crypto';
import { TIMEZONE } from './format';

/**
 * Génération des références métier :
 *   KP-EST-AAAAMMJJ-XXXX pour les simulations
 *   KP-CMD-AAAAMMJJ-XXXX pour les commandes
 *
 * Le suffixe est tiré aléatoirement dans un alphabet sans caractères ambigus
 * (ni 0/O ni 1/I). L'unicité est garantie en base par une contrainte `unique` ;
 * l'appelant réessaie tant qu'une collision est détectée.
 */

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SUFFIX_LENGTH = 4;

export type ReferenceKind = 'EST' | 'CMD';

export function formatDatePart(date: Date = new Date()): string {
  // en-CA produit AAAA-MM-JJ ; on retire les tirets.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date).replaceAll('-', '');
}

export function randomSuffix(length = SUFFIX_LENGTH): string {
  let suffix = '';
  for (let index = 0; index < length; index += 1) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return suffix;
}

export function buildReference(kind: ReferenceKind, date: Date = new Date()): string {
  return `KP-${kind}-${formatDatePart(date)}-${randomSuffix()}`;
}

export const REFERENCE_PATTERN = /^KP-(EST|CMD)-\d{8}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4,8}$/;

export function isValidReference(reference: string): boolean {
  return REFERENCE_PATTERN.test(reference);
}

/**
 * Génère une référence unique en s'appuyant sur un test d'existence fourni par
 * l'appelant (requête base). Après plusieurs collisions, la longueur du suffixe
 * est augmentée pour garantir la terminaison.
 */
export async function generateUniqueReference(
  kind: ReferenceKind,
  exists: (reference: string) => Promise<boolean>,
  maxAttempts = 12,
): Promise<string> {
  const datePart = formatDatePart();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const length = SUFFIX_LENGTH + Math.floor(attempt / 4);
    const reference = `KP-${kind}-${datePart}-${randomSuffix(length)}`;
    if (!(await exists(reference))) {
      return reference;
    }
  }
  throw new Error(
    `Impossible de générer une référence ${kind} unique après ${maxAttempts} tentatives.`,
  );
}

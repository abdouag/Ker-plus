/**
 * Normalisation des numéros de téléphone.
 *
 * Objectif : accepter les formats usuels sénégalais (77 123 45 67,
 * 221771234567, +221 77 123 45 67, 00221771234567) et les normaliser en
 * +221XXXXXXXXX, sans jamais bloquer un client de la diaspora utilisant un
 * autre indicatif international.
 */

const SENEGAL_CODE = '221';
/** Préfixes mobiles et fixes actuellement en service au Sénégal. */
const SENEGAL_PREFIXES = ['70', '75', '76', '77', '78', '79', '30', '33', '32', '34'];

export interface NormalizedPhone {
  /** Numéro normalisé, au format international si possible. */
  value: string;
  /** Vrai si le numéro a pu être rattaché au plan de numérotation sénégalais. */
  senegalese: boolean;
}

function stripFormatting(input: string): string {
  return input.replace(/[\s.\-()/]/g, '');
}

/**
 * Retourne le numéro normalisé, ou `null` si l'entrée ne peut pas être
 * considérée comme un numéro de téléphone plausible.
 */
export function normalizePhone(input: string): NormalizedPhone | null {
  if (!input) return null;

  let digits = stripFormatting(input.trim());
  if (!digits) return null;

  let hasPlus = digits.startsWith('+');
  if (hasPlus) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
    hasPlus = true;
  }

  if (!/^\d+$/.test(digits)) return null;

  // Format national sénégalais : 9 chiffres commençant par un préfixe connu.
  if (!hasPlus && digits.length === 9 && SENEGAL_PREFIXES.includes(digits.slice(0, 2))) {
    return { value: `+${SENEGAL_CODE}${digits}`, senegalese: true };
  }

  // Format international sénégalais : 221 + 9 chiffres.
  if (digits.startsWith(SENEGAL_CODE) && digits.length === 12) {
    const national = digits.slice(3);
    return {
      value: `+${SENEGAL_CODE}${national}`,
      senegalese: SENEGAL_PREFIXES.includes(national.slice(0, 2)),
    };
  }

  // Diaspora / autres indicatifs : longueur E.164 plausible (8 à 15 chiffres).
  if (digits.length >= 8 && digits.length <= 15) {
    return { value: `+${digits}`, senegalese: false };
  }

  return null;
}

/** Validation souple utilisée par Zod. */
export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

/** Affichage lisible : +221 77 123 45 67. */
export function formatPhone(input: string): string {
  const normalized = normalizePhone(input);
  if (!normalized) return input;
  if (!normalized.senegalese) return normalized.value;
  const national = normalized.value.slice(4);
  return `+${SENEGAL_CODE} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7, 9)}`;
}

/** Numéro utilisable dans une URL wa.me (chiffres uniquement). */
export function toWhatsAppDigits(input: string): string {
  const normalized = normalizePhone(input);
  return (normalized?.value ?? input).replace(/\D/g, '');
}

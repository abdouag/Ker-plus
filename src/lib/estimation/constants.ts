/**
 * Constantes métier de l'estimateur.
 *
 * Conventions numériques (aucun flottant n'est stocké en base) :
 *  - les coefficients sont persistés multipliés par 1000  (1,10  -> 1100) ;
 *  - les pourcentages sont persistés multipliés par 100   (10 %  -> 1000) ;
 *  - les montants sont persistés en FCFA entiers.
 */

export const COEFFICIENT_SCALE = 1000;
export const PERCENTAGE_SCALE = 100;

export const SURFACE_MIN = 80;
export const SURFACE_MAX = 500;
export const SURFACE_DEFAULT = 150;
export const SURFACE_STEP = 1;

export const CURRENCY = 'XOF';
export const CURRENCY_LABEL = 'FCFA';

/** Bornes de sécurité appliquées aux paramètres administrables. */
export const COEFFICIENT_MIN = 100; // 0,10
export const COEFFICIENT_MAX = 10_000; // 10,00
export const PRICE_PER_SQM_MIN = 10_000;
export const PRICE_PER_SQM_MAX = 5_000_000;
export const RANGE_PERCENTAGE_MIN = 0; // 0 %
export const RANGE_PERCENTAGE_MAX = 5_000; // 50 %

/** Conversion lisible -> entier persistable. */
export function toCoefficientInt(value: number): number {
  return Math.round(value * COEFFICIENT_SCALE);
}

/** Conversion entier persisté -> valeur lisible. */
export function fromCoefficientInt(value: number): number {
  return value / COEFFICIENT_SCALE;
}

export function toPercentageInt(value: number): number {
  return Math.round(value * PERCENTAGE_SCALE);
}

export function fromPercentageInt(value: number): number {
  return value / PERCENTAGE_SCALE;
}

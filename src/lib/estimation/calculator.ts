import {
  COEFFICIENT_MAX,
  COEFFICIENT_MIN,
  COEFFICIENT_SCALE,
  PERCENTAGE_SCALE,
  PRICE_PER_SQM_MAX,
  PRICE_PER_SQM_MIN,
  RANGE_PERCENTAGE_MAX,
  RANGE_PERCENTAGE_MIN,
  SURFACE_MAX,
  SURFACE_MIN,
} from './constants';

/**
 * Entrées du calcul, toutes exprimées en entiers.
 * `projectCoefficient` et `cityCoefficient` sont ×1000, `rangePercentage` ×100.
 */
export interface EstimationInput {
  surface: number;
  pricePerSquareMeter: number;
  cityCoefficient: number;
  projectCoefficient: number;
  rangePercentage: number;
}

export interface EstimationResult {
  estimatedTotal: number;
  estimatedMinimum: number;
  estimatedMaximum: number;
}

export class EstimationError extends Error {
  constructor(
    message: string,
    readonly field: keyof EstimationInput,
  ) {
    super(message);
    this.name = 'EstimationError';
  }
}

function assertInteger(value: number, field: keyof EstimationInput): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new EstimationError(`La valeur « ${field} » doit être un entier valide.`, field);
  }
}

function assertRange(
  value: number,
  min: number,
  max: number,
  field: keyof EstimationInput,
  label: string,
): void {
  if (value < min || value > max) {
    throw new EstimationError(`${label} doit être comprise entre ${min} et ${max}.`, field);
  }
}

/**
 * Valide les entrées du calcul. Toute valeur hors bornes est rejetée : le
 * serveur ne fait jamais confiance aux données transmises par le navigateur.
 */
export function validateEstimationInput(input: EstimationInput): void {
  (Object.keys(input) as (keyof EstimationInput)[]).forEach((field) =>
    assertInteger(input[field], field),
  );

  assertRange(input.surface, SURFACE_MIN, SURFACE_MAX, 'surface', 'La surface construite');
  assertRange(
    input.pricePerSquareMeter,
    PRICE_PER_SQM_MIN,
    PRICE_PER_SQM_MAX,
    'pricePerSquareMeter',
    'Le prix au m²',
  );
  assertRange(
    input.cityCoefficient,
    COEFFICIENT_MIN,
    COEFFICIENT_MAX,
    'cityCoefficient',
    'Le coefficient de ville',
  );
  assertRange(
    input.projectCoefficient,
    COEFFICIENT_MIN,
    COEFFICIENT_MAX,
    'projectCoefficient',
    'Le coefficient de type de projet',
  );
  assertRange(
    input.rangePercentage,
    RANGE_PERCENTAGE_MIN,
    RANGE_PERCENTAGE_MAX,
    'rangePercentage',
    'La variation de fourchette',
  );
}

/**
 * Division entière avec arrondi au plus proche (0,5 arrondi vers le haut),
 * effectuée en BigInt afin d'éviter toute perte de précision flottante.
 */
function divideRound(numerator: bigint, denominator: bigint): number {
  const doubled = numerator * 2n + denominator;
  const quotient = doubled / (denominator * 2n);
  return Number(quotient);
}

/**
 * Estimation centrale = surface × prix au m² × coefficient de ville
 *                       × coefficient du type de projet.
 * Fourchette basse/haute = estimation centrale × (1 ∓ variation).
 *
 * Tous les montants retournés sont des entiers de FCFA.
 */
export function computeEstimation(input: EstimationInput): EstimationResult {
  validateEstimationInput(input);

  const scale = BigInt(COEFFICIENT_SCALE) * BigInt(COEFFICIENT_SCALE);
  const raw =
    BigInt(input.surface) *
    BigInt(input.pricePerSquareMeter) *
    BigInt(input.cityCoefficient) *
    BigInt(input.projectCoefficient);

  const estimatedTotal = divideRound(raw, scale);

  const percentScale = BigInt(PERCENTAGE_SCALE) * 100n; // 100 % => 10 000
  const delta = BigInt(input.rangePercentage);
  const total = BigInt(estimatedTotal);

  const estimatedMinimum = divideRound(total * (percentScale - delta), percentScale);
  const estimatedMaximum = divideRound(total * (percentScale + delta), percentScale);

  return { estimatedTotal, estimatedMinimum, estimatedMaximum };
}

/**
 * Calcul des devis Kër Care — fonctions pures, montants en FCFA entiers.
 *
 * Le total est TOUJOURS recalculé côté serveur à partir des lignes et des
 * frais : aucun total transmis par le navigateur n'est accepté.
 */

export interface QuoteLineInput {
  label: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteInput {
  lines: QuoteLineInput[];
  travelFee: number;
  diagnosticFee: number;
  laborAmount: number;
  otherFees: number;
  discountAmount: number;
  taxAmount: number;
}

export interface ComputedQuoteLine extends QuoteLineInput {
  total: number;
}

export interface ComputedQuote {
  lines: ComputedQuoteLine[];
  partsAmount: number;
  subtotal: number;
  totalAmount: number;
}

export class QuoteValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'QuoteValidationError';
  }
}

const MAX_AMOUNT = 1_000_000_000;

function assertAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_AMOUNT) {
    throw new QuoteValidationError(`${label} : montant invalide (entier positif en FCFA attendu).`);
  }
}

export function computeQuote(input: QuoteInput): ComputedQuote {
  const lines = input.lines.map((line, index) => {
    const label = line.label.trim();
    if (!label) throw new QuoteValidationError(`Ligne ${index + 1} : libellé manquant.`);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10_000) {
      throw new QuoteValidationError(`Ligne ${index + 1} : quantité invalide.`);
    }
    assertAmount(line.unitPrice, `Ligne ${index + 1}`);
    return {
      label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.quantity * line.unitPrice,
    };
  });

  assertAmount(input.travelFee, 'Déplacement');
  assertAmount(input.diagnosticFee, 'Diagnostic');
  assertAmount(input.laborAmount, 'Main-d’œuvre');
  assertAmount(input.otherFees, 'Frais');
  assertAmount(input.discountAmount, 'Remise');
  assertAmount(input.taxAmount, 'Taxes');

  const partsAmount = lines.reduce((sum, line) => sum + line.total, 0);
  const subtotal =
    partsAmount + input.travelFee + input.diagnosticFee + input.laborAmount + input.otherFees;

  if (input.discountAmount > subtotal) {
    throw new QuoteValidationError('La remise ne peut pas dépasser le montant du devis.');
  }

  const totalAmount = subtotal - input.discountAmount + input.taxAmount;
  if (totalAmount <= 0) {
    throw new QuoteValidationError('Le devis doit comporter un montant total positif.');
  }
  assertAmount(totalAmount, 'Total');

  return { lines, partsAmount, subtotal, totalAmount };
}

/**
 * Répartition indicative d'un montant client : commission Kerplus et
 * rémunération du prestataire. `ratePercentX100` : 1000 = 10 %.
 */
export function splitCommission(
  totalAmount: number,
  ratePercentX100: number,
): { commission: number; providerShare: number } {
  const rate = Math.min(Math.max(ratePercentX100, 0), 10_000);
  const commission = Math.round((totalAmount * rate) / 10_000);
  return { commission, providerShare: totalAmount - commission };
}

/** Vrai si le devis n'est plus acceptable à la date donnée. */
export function isQuoteExpired(validUntil: Date, now: Date = new Date()): boolean {
  return validUntil.getTime() < now.getTime();
}

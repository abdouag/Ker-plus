import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  availableTransitions,
  canTransition,
  TransitionError,
} from '@/lib/care/workflow';
import {
  computeQuote,
  isQuoteExpired,
  QuoteValidationError,
  splitCommission,
} from '@/lib/care/quote';
import { addMonths, computeNextDue, isDueSoon, taskBucket } from '@/lib/care/maintenance';
import { sniffMimeType } from '@/lib/care/storage';
import { combineDateTime, requestSchema, splitList } from '@/lib/care/validation';

const baseQuote = {
  lines: [] as { label: string; quantity: number; unitPrice: number }[],
  travelFee: 0,
  diagnosticFee: 0,
  laborAmount: 0,
  otherFees: 0,
  discountAmount: 0,
  taxAmount: 0,
};

describe('workflow des demandes', () => {
  it('autorise le parcours nominal avec les bons acteurs', () => {
    const path: [string, string, 'CLIENT' | 'PROVIDER' | 'ADMIN'][] = [
      ['SUBMITTED', 'ASSIGNED', 'ADMIN'],
      ['ASSIGNED', 'ACCEPTED', 'PROVIDER'],
      ['ACCEPTED', 'QUOTE_SENT', 'PROVIDER'],
      ['QUOTE_SENT', 'QUOTE_ACCEPTED', 'CLIENT'],
      ['QUOTE_ACCEPTED', 'SCHEDULED', 'CLIENT'],
      ['SCHEDULED', 'EN_ROUTE', 'PROVIDER'],
      ['EN_ROUTE', 'ARRIVED', 'PROVIDER'],
      ['ARRIVED', 'IN_PROGRESS', 'PROVIDER'],
      ['IN_PROGRESS', 'WORK_DONE', 'PROVIDER'],
      ['WORK_DONE', 'VALIDATED', 'CLIENT'],
      ['VALIDATED', 'CLOSED', 'ADMIN'],
    ];
    for (const [from, to, actor] of path) {
      expect(canTransition(from as never, to as never, actor), `${from} → ${to}`).toBe(true);
    }
  });

  it('refuse les transitions interdites ou par le mauvais acteur', () => {
    expect(canTransition('SUBMITTED', 'ASSIGNED', 'CLIENT')).toBe(false);
    expect(canTransition('QUOTE_SENT', 'QUOTE_ACCEPTED', 'PROVIDER')).toBe(false);
    expect(canTransition('SUBMITTED', 'WORK_DONE', 'PROVIDER')).toBe(false);
    expect(canTransition('WORK_DONE', 'VALIDATED', 'PROVIDER')).toBe(false);
    expect(canTransition('CLOSED', 'IN_PROGRESS', 'ADMIN')).toBe(false);
    expect(canTransition('CANCELLED', 'SUBMITTED', 'ADMIN')).toBe(false);
    expect(() => assertTransition('IN_PROGRESS', 'CANCELLED', 'CLIENT')).toThrow(TransitionError);
  });

  it("limite l'annulation client aux étapes précédant le rendez-vous", () => {
    expect(availableTransitions('QUOTE_ACCEPTED', 'CLIENT')).toContain('CANCELLED');
    expect(availableTransitions('SCHEDULED', 'CLIENT')).not.toContain('CANCELLED');
    expect(availableTransitions('SCHEDULED', 'ADMIN')).toContain('CANCELLED');
  });

  it('permet refus de devis, révision et contestation', () => {
    expect(canTransition('QUOTE_SENT', 'QUOTE_REFUSED', 'CLIENT')).toBe(true);
    expect(canTransition('QUOTE_REFUSED', 'QUOTE_SENT', 'PROVIDER')).toBe(true);
    expect(canTransition('WORK_DONE', 'DISPUTED', 'CLIENT')).toBe(true);
    expect(canTransition('DISPUTED', 'IN_PROGRESS', 'ADMIN')).toBe(true);
  });
});

describe('calcul des devis', () => {
  it('calcule un total exact en francs entiers', () => {
    const result = computeQuote({
      ...baseQuote,
      lines: [
        { label: 'Gaz R410A', quantity: 2, unitPrice: 12_500 },
        { label: 'Filtre', quantity: 1, unitPrice: 7_000 },
      ],
      travelFee: 3_000,
      diagnosticFee: 5_000,
      laborAmount: 20_000,
      otherFees: 1_000,
      discountAmount: 2_000,
      taxAmount: 0,
    });
    expect(result.partsAmount).toBe(32_000);
    expect(result.subtotal).toBe(61_000);
    expect(result.totalAmount).toBe(59_000);
    expect(result.lines[0].total).toBe(25_000);
  });

  it('rejette montants négatifs, décimaux, remise excessive et total nul', () => {
    expect(() => computeQuote({ ...baseQuote, laborAmount: -1 })).toThrow(QuoteValidationError);
    expect(() => computeQuote({ ...baseQuote, laborAmount: 10.5 })).toThrow(QuoteValidationError);
    expect(() => computeQuote({ ...baseQuote, laborAmount: 1000, discountAmount: 2000 })).toThrow(
      /remise/,
    );
    expect(() => computeQuote(baseQuote)).toThrow(/positif/);
    expect(() =>
      computeQuote({ ...baseQuote, lines: [{ label: ' ', quantity: 1, unitPrice: 10 }] }),
    ).toThrow(/libellé/);
  });

  it('répartit la commission et détecte l’expiration', () => {
    expect(splitCommission(59_000, 1000)).toEqual({ commission: 5_900, providerShare: 53_100 });
    expect(
      splitCommission(10_001, 1000).commission + splitCommission(10_001, 1000).providerShare,
    ).toBe(10_001);
    const now = new Date('2026-11-26T12:00:00Z');
    expect(isQuoteExpired(new Date('2026-11-25T23:59:59Z'), now)).toBe(true);
    expect(isQuoteExpired(new Date('2026-11-27T00:00:00Z'), now)).toBe(false);
  });
});

describe('échéances de maintenance', () => {
  it('ajoute des mois en gérant les fins de mois', () => {
    expect(addMonths(new Date('2026-01-31T12:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T12:00:00.000Z',
    );
    expect(addMonths(new Date('2026-08-15T12:00:00Z'), 6).toISOString()).toBe(
      '2027-02-15T12:00:00.000Z',
    );
  });

  it('calcule la prochaine échéance depuis le dernier entretien ou l’installation', () => {
    const now = new Date('2026-11-26T12:00:00Z');
    expect(
      computeNextDue(6, { lastServiceAt: new Date('2026-06-01T12:00:00Z') }, now)?.toISOString(),
    ).toBe('2026-12-01T12:00:00.000Z');
    expect(
      computeNextDue(12, { installedAt: new Date('2025-01-10T12:00:00Z') }, now)?.toISOString(),
    ).toBe('2026-01-10T12:00:00.000Z');
    expect(computeNextDue(6, {}, now)?.toISOString()).toBe('2027-05-26T12:00:00.000Z');
    expect(computeNextDue(null, {}, now)).toBeNull();
  });

  it('classe les tâches (en retard, à prévoir, planifiées, effectuées)', () => {
    const now = new Date('2026-11-26T12:00:00Z');
    expect(taskBucket({ status: 'TODO', dueAt: new Date('2026-11-01T00:00:00Z') }, now)).toBe(
      'overdue',
    );
    expect(taskBucket({ status: 'TODO', dueAt: new Date('2026-12-01T00:00:00Z') }, now)).toBe(
      'upcoming',
    );
    expect(taskBucket({ status: 'PLANNED', dueAt: new Date('2026-11-01T00:00:00Z') }, now)).toBe(
      'planned',
    );
    expect(taskBucket({ status: 'DONE', dueAt: new Date('2026-11-01T00:00:00Z') }, now)).toBe(
      'done',
    );
    expect(isDueSoon(new Date('2026-12-10T00:00:00Z'), 30, now)).toBe(true);
    expect(isDueSoon(new Date('2027-03-10T00:00:00Z'), 30, now)).toBe(false);
  });
});

describe('fichiers et validation', () => {
  it('identifie le type réel par la signature binaire', () => {
    expect(sniffMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMimeType(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    );
    expect(sniffMimeType(Buffer.from('<svg onload=alert(1)>'))).toBeNull();
    expect(sniffMimeType(Buffer.from('MZ executable'))).toBeNull();
  });

  it('valide une demande et combine date + heure en heure de Dakar', () => {
    const parsed = requestSchema.safeParse({
      idempotencyKey: 'a'.repeat(32),
      propertyId: 'p1',
      categoryId: 'c1',
      description: 'Fuite',
      kind: 'QUICK_REPAIR',
      safetyAcknowledged: false,
    });
    expect(parsed.success).toBe(false);
    expect(combineDateTime(new Date('2026-12-02T12:00:00Z'), '09:30').toISOString()).toBe(
      '2026-12-02T09:30:00.000Z',
    );
    expect(splitList('Dakar, Pikine\nGuédiawaye;Rufisque')).toEqual([
      'Dakar',
      'Pikine',
      'Guédiawaye',
      'Rufisque',
    ]);
  });
});

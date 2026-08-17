import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateISO,
  formatDateTime,
  formatDecimal,
  formatPercentage,
  formatSurface,
  formatXOF,
  formatXOFCompact,
} from '@/lib/format';

/** Espace insécable étroit utilisé comme séparateur. */
const NNBSP = ' ';

describe('formatXOF', () => {
  it('formate à la française avec séparateur de milliers', () => {
    expect(formatXOF(36_300_000)).toBe(`36${NNBSP}300${NNBSP}000${NNBSP}FCFA`);
    expect(formatXOF(50_000)).toBe(`50${NNBSP}000${NNBSP}FCFA`);
    expect(formatXOF(999)).toBe(`999${NNBSP}FCFA`);
    expect(formatXOF(0)).toBe(`0${NNBSP}FCFA`);
  });

  it('peut omettre la devise', () => {
    expect(formatXOF(32_670_000, { withCurrency: false })).toBe(`32${NNBSP}670${NNBSP}000`);
  });

  it('gère les montants négatifs', () => {
    expect(formatXOF(-1_500)).toBe(`-1${NNBSP}500${NNBSP}FCFA`);
  });

  it('arrondit à l’entier', () => {
    expect(formatXOF(1_500.6)).toBe(`1${NNBSP}501${NNBSP}FCFA`);
  });

  it('formate en version compacte', () => {
    expect(formatXOFCompact(36_300_000)).toBe(`36,3${NNBSP}M${NNBSP}FCFA`);
    expect(formatXOFCompact(150_000)).toBe(`150${NNBSP}k${NNBSP}FCFA`);
    expect(formatXOFCompact(800)).toBe(`800${NNBSP}FCFA`);
  });
});

describe('autres formatages', () => {
  it('formate les décimaux avec une virgule', () => {
    expect(formatDecimal(1.1)).toBe('1,10');
    expect(formatDecimal(0.95)).toBe('0,95');
  });

  it('formate les pourcentages stockés ×100', () => {
    expect(formatPercentage(1000)).toBe(`10${NNBSP}%`);
    expect(formatPercentage(750)).toBe(`7,50${NNBSP}%`);
  });

  it('formate les surfaces', () => {
    expect(formatSurface(150)).toBe(`150${NNBSP}m²`);
  });

  it('formate les dates dans le fuseau Africa/Dakar', () => {
    const date = new Date('2026-03-15T10:30:00.000Z');
    expect(formatDate(date)).toBe('15 mars 2026');
    expect(formatDateISO(date)).toBe('2026-03-15');
    expect(formatDateTime(date)).toContain('15/03/2026');
  });

  it('gère les valeurs absentes ou invalides', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDate(new Date('invalide'))).toBe('—');
    expect(formatDateISO(null)).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildReference,
  formatDatePart,
  generateUniqueReference,
  isValidReference,
  randomSuffix,
} from '@/lib/reference';

describe('références métier', () => {
  it('respecte le format KP-EST-AAAAMMJJ-XXXX', () => {
    const reference = buildReference('EST', new Date('2026-03-15T12:00:00Z'));
    expect(reference).toMatch(/^KP-EST-20260315-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(isValidReference(reference)).toBe(true);
  });

  it('respecte le format KP-CMD-AAAAMMJJ-XXXX', () => {
    const reference = buildReference('CMD', new Date('2026-12-31T23:00:00Z'));
    expect(reference.startsWith('KP-CMD-20261231-')).toBe(true);
    expect(isValidReference(reference)).toBe(true);
  });

  it('rejette les références mal formées', () => {
    [
      '',
      'KP-EST-2026-03-15-ABCD',
      'KP-XXX-20260315-ABCD',
      'KP-EST-20260315-abcd',
      'KP-EST-20260315-AB0D',
      "KP-EST-20260315-ABCD' OR 1=1",
    ].forEach((value) => {
      expect(isValidReference(value), value).toBe(false);
    });
  });

  it('n’utilise aucun caractère ambigu (0, O, 1, I)', () => {
    const suffixes = Array.from({ length: 400 }, () => randomSuffix());
    expect(suffixes.join('')).not.toMatch(/[01OI]/);
  });

  it('produit des suffixes suffisamment variés', () => {
    const suffixes = new Set(Array.from({ length: 500 }, () => randomSuffix()));
    // 32^4 ≈ 1 million de combinaisons : les collisions doivent rester rares.
    expect(suffixes.size).toBeGreaterThan(490);
  });

  it('calcule la partie date dans le fuseau de Dakar', () => {
    expect(formatDatePart(new Date('2026-03-15T23:30:00Z'))).toBe('20260315');
  });

  it('réessaie jusqu’à obtenir une référence libre', () => {
    const used = new Set<string>();
    let calls = 0;
    return generateUniqueReference('EST', async (candidate) => {
      calls += 1;
      // Les deux premières propositions sont considérées comme déjà prises.
      if (calls <= 2) {
        used.add(candidate);
        return true;
      }
      return false;
    }).then((reference) => {
      expect(calls).toBe(3);
      expect(used.has(reference)).toBe(false);
      expect(isValidReference(reference)).toBe(true);
    });
  });

  it('échoue explicitement si aucune référence libre n’est trouvée', async () => {
    await expect(generateUniqueReference('CMD', async () => true, 3)).rejects.toThrow(
      /unique après 3 tentatives/,
    );
  });
});

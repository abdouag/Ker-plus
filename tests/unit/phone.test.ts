import { describe, expect, it } from 'vitest';
import { formatPhone, isValidPhone, normalizePhone, toWhatsAppDigits } from '@/lib/phone';

describe('normalizePhone', () => {
  it('normalise les formats sénégalais usuels', () => {
    const expected = '+221771234567';
    [
      '771234567',
      '77 123 45 67',
      '77-123-45-67',
      '77.123.45.67',
      '+221771234567',
      '+221 77 123 45 67',
      '00221771234567',
      '221771234567',
    ].forEach((input) => {
      const result = normalizePhone(input);
      expect(result, input).not.toBeNull();
      expect(result?.value, input).toBe(expected);
      expect(result?.senegalese, input).toBe(true);
    });
  });

  it('accepte les préfixes fixes sénégalais', () => {
    expect(normalizePhone('338691234')?.value).toBe('+221338691234');
  });

  it('n’écarte pas les numéros de la diaspora', () => {
    expect(normalizePhone('+33612345678')).toEqual({ value: '+33612345678', senegalese: false });
    expect(normalizePhone('+1 202 555 0173')).toEqual({ value: '+12025550173', senegalese: false });
    expect(normalizePhone('+39 06 1234 5678')?.senegalese).toBe(false);
  });

  it('rejette les entrées non exploitables', () => {
    ['', '   ', 'abcdefgh', '123', '+', '+00', '1234567890123456789'].forEach((input) => {
      expect(normalizePhone(input), input).toBeNull();
      expect(isValidPhone(input), input).toBe(false);
    });
  });

  it('rejette un numéro sénégalais incomplet (8 chiffres)', () => {
    ['77123456', '77 12 34 56', '3386912'].forEach((input) => {
      expect(normalizePhone(input), input).toBeNull();
      expect(isValidPhone(input), input).toBe(false);
    });
  });

  it('exige le format international explicite pour les numéros hors Sénégal', () => {
    // Sans + ni 00, impossible de distinguer un indicatif étranger d'une faute de frappe.
    expect(normalizePhone('33612345678')).toBeNull();
    expect(normalizePhone('+33612345678')).not.toBeNull();
    expect(normalizePhone('0033612345678')).not.toBeNull();
  });
});

describe('affichage', () => {
  it('formate un numéro sénégalais de façon lisible', () => {
    expect(formatPhone('771234567')).toBe('+221 77 123 45 67');
  });

  it('laisse les numéros internationaux au format E.164', () => {
    expect(formatPhone('+33612345678')).toBe('+33612345678');
  });

  it('produit un identifiant WhatsApp sans caractère parasite', () => {
    expect(toWhatsAppDigits('+221 77 123 45 67')).toBe('221771234567');
  });
});

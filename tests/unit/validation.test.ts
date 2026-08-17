import { describe, expect, it } from 'vitest';
import {
  createOrderSchema,
  customerSchema,
  estimationInputSchema,
  loginSchema,
} from '@/lib/validation/schemas';
import { canTransition, ORDER_TRANSITIONS } from '@/lib/services/orders';

const VALID_CUSTOMER = {
  firstName: 'Awa',
  lastName: 'Ndiaye',
  phone: '77 123 45 67',
  whatsappSameAsPhone: true,
  email: 'Awa.Ndiaye@Example.com',
  city: 'Dakar',
  acceptTerms: true,
  consentData: true,
};

describe('estimationInputSchema', () => {
  it('accepte des identifiants et une surface valides', () => {
    const parsed = estimationInputSchema.safeParse({
      projectTypeId: 'clx123abc',
      surface: 150,
      cityZoneId: 'clx456def',
      finishLevelId: 'clx789ghi',
    });
    expect(parsed.success).toBe(true);
  });

  it('refuse les surfaces hors bornes et non entières', () => {
    const base = {
      projectTypeId: 'a1',
      cityZoneId: 'b2',
      finishLevelId: 'c3',
    };
    [79, 501, 150.5, -10].forEach((surface) => {
      expect(estimationInputSchema.safeParse({ ...base, surface }).success, String(surface)).toBe(
        false,
      );
    });
  });

  it('refuse les identifiants contenant des caractères d’injection', () => {
    const parsed = estimationInputSchema.safeParse({
      projectTypeId: "1'; DROP TABLE simulations;--",
      surface: 150,
      cityZoneId: 'b2',
      finishLevelId: 'c3',
    });
    expect(parsed.success).toBe(false);
  });

  it('ignore tout montant transmis par le navigateur', () => {
    const parsed = estimationInputSchema.parse({
      projectTypeId: 'a1',
      surface: 150,
      cityZoneId: 'b2',
      finishLevelId: 'c3',
      estimatedTotal: 1,
      amount: 1,
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty('estimatedTotal');
    expect(parsed).not.toHaveProperty('amount');
  });
});

describe('customerSchema', () => {
  it('normalise le téléphone et l’email', () => {
    const parsed = customerSchema.parse(VALID_CUSTOMER);
    expect(parsed.phone).toBe('+221771234567');
    expect(parsed.email).toBe('awa.ndiaye@example.com');
  });

  it('exige l’acceptation des conditions et le consentement', () => {
    expect(customerSchema.safeParse({ ...VALID_CUSTOMER, acceptTerms: false }).success).toBe(false);
    expect(customerSchema.safeParse({ ...VALID_CUSTOMER, consentData: false }).success).toBe(false);
  });

  it('refuse une adresse email invalide', () => {
    expect(customerSchema.safeParse({ ...VALID_CUSTOMER, email: 'pas-un-email' }).success).toBe(
      false,
    );
  });

  it('refuse un numéro invalide mais accepte la diaspora', () => {
    expect(customerSchema.safeParse({ ...VALID_CUSTOMER, phone: '12' }).success).toBe(false);
    expect(customerSchema.safeParse({ ...VALID_CUSTOMER, phone: '+33612345678' }).success).toBe(
      true,
    );
  });
});

describe('createOrderSchema', () => {
  const base = {
    ...VALID_CUSTOMER,
    projectTypeId: 'a1',
    surface: 150,
    cityZoneId: 'b2',
    finishLevelId: 'c3',
  };

  it('accepte une commande complète', () => {
    expect(createOrderSchema.safeParse(base).success).toBe(true);
  });

  it('exige un numéro WhatsApp quand il diffère du téléphone', () => {
    const missing = createOrderSchema.safeParse({
      ...base,
      whatsappSameAsPhone: false,
      whatsapp: '',
    });
    expect(missing.success).toBe(false);

    const invalid = createOrderSchema.safeParse({
      ...base,
      whatsappSameAsPhone: false,
      whatsapp: 'abc',
    });
    expect(invalid.success).toBe(false);

    const valid = createOrderSchema.safeParse({
      ...base,
      whatsappSameAsPhone: false,
      whatsapp: '76 000 00 00',
    });
    expect(valid.success).toBe(true);
  });

  it('rejette une soumission dont le champ leurre est rempli', () => {
    const parsed = createOrderSchema.safeParse({ ...base, website: 'https://spam.example' });
    expect(parsed.success).toBe(false);
  });

  it('n’expose aucun montant modifiable par le client', () => {
    const parsed = createOrderSchema.parse({ ...base, amount: 1, price: 1 } as Record<
      string,
      unknown
    >);
    expect(parsed).not.toHaveProperty('amount');
    expect(parsed).not.toHaveProperty('price');
  });
});

describe('loginSchema', () => {
  it('normalise l’email et impose une longueur minimale', () => {
    expect(loginSchema.parse({ email: 'ADMIN@Kerplus.SN', password: 'motdepasse12' }).email).toBe(
      'admin@kerplus.sn',
    );
    expect(loginSchema.safeParse({ email: 'admin@kerplus.sn', password: 'court' }).success).toBe(
      false,
    );
  });
});

describe('transitions de statut de commande', () => {
  it('autorise uniquement les transitions prévues', () => {
    expect(canTransition('AWAITING_PAYMENT', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'IN_PREPARATION')).toBe(true);
    expect(canTransition('READY', 'DELIVERED')).toBe(true);
    expect(canTransition('DELIVERED', 'AWAITING_PAYMENT')).toBe(false);
    expect(canTransition('CANCELLED', 'PAID')).toBe(false);
    expect(canTransition('AWAITING_PAYMENT', 'DELIVERED')).toBe(false);
  });

  it('ne laisse aucune sortie aux états terminaux', () => {
    expect(ORDER_TRANSITIONS.CANCELLED).toHaveLength(0);
    expect(ORDER_TRANSITIONS.REFUNDED).toHaveLength(0);
  });
});

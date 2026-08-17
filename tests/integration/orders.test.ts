import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createOrder, OrderError } from '@/lib/services/orders';
import { computeServerEstimation, persistSimulation } from '@/lib/services/estimation';
import { createOrderSchema } from '@/lib/validation/schemas';
import { setSetting, SETTING_KEYS } from '@/lib/settings';
import {
  orderPayload,
  prisma,
  resetDatabase,
  seedReferentials,
  type SeededReferentials,
} from './helpers';

let referentials: SeededReferentials;

beforeEach(async () => {
  await resetDatabase();
  referentials = await seedReferentials();
  process.env.PAYMENT_PROVIDER = 'wave_link';
  process.env.WAVE_PAYMENT_URL = 'https://wave.com/pay/kerplus';
});

afterAll(async () => {
  await prisma.$disconnect();
});

function parsePayload(overrides: Record<string, unknown> = {}) {
  return createOrderSchema.parse(orderPayload(referentials, overrides));
}

describe('création de commande', () => {
  it('enregistre client, simulation, commande et paiement en attente', async () => {
    const result = await createOrder(parsePayload(), { ipHash: 'empreinte' });

    expect(result.order.reference).toMatch(/^KP-CMD-\d{8}-[A-Z2-9]{4}$/);
    expect(result.order.status).toBe('AWAITING_PAYMENT');
    expect(result.order.amount).toBe(50_000);
    expect(result.order.currency).toBe('XOF');
    expect(result.payment.status).toBe('PENDING');
    expect(result.payment.verified).toBe(false);
    expect(result.requiresManualConfirmation).toBe(true);
    expect(result.redirectUrl).toBe('https://wave.com/pay/kerplus');

    const customer = await prisma.customer.findFirstOrThrow();
    expect(customer.email).toBe('awa.ndiaye@example.com');
    expect(customer.phone).toBe('+221771234567');
    expect(customer.whatsapp).toBe('+221771234567');
    expect(customer.consentAt).not.toBeNull();

    const simulation = await prisma.simulation.findFirstOrThrow();
    expect(simulation.customerId).toBe(customer.id);
    expect(simulation.estimatedTotal).toBe(36_300_000);

    const call = await prisma.consultationCall.findFirstOrThrow();
    expect(call.status).toBe('NOT_SCHEDULED');
    expect(result.order.dueAt).not.toBeNull();
  });

  it('fige le montant à partir du paramètre serveur, jamais du navigateur', async () => {
    await setSetting(SETTING_KEYS.PREMIUM_REPORT_PRICE, '75000');

    // Un montant injecté dans la requête est retiré par la validation.
    const payload = createOrderSchema.parse(
      orderPayload(referentials, { amount: 1, price: 1 }) as Record<string, unknown>,
    );
    expect(payload).not.toHaveProperty('amount');

    const result = await createOrder(payload);
    expect(result.order.amount).toBe(75_000);
    expect(result.payment.amount).toBe(75_000);

    // Une évolution ultérieure du tarif ne modifie pas la commande existante.
    await setSetting(SETTING_KEYS.PREMIUM_REPORT_PRICE, '90000');
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: result.order.id } });
    expect(stored.amount).toBe(75_000);
  });

  it('recalcule l’estimation côté serveur même si le client ment sur les montants', async () => {
    const result = await createOrder(
      createOrderSchema.parse({
        ...orderPayload(referentials),
        estimatedTotal: 1_000,
        estimatedMinimum: 1,
        estimatedMaximum: 2,
      } as Record<string, unknown>),
    );

    const simulation = await prisma.simulation.findUniqueOrThrow({
      where: { id: result.order.simulationId ?? '' },
    });
    expect(simulation.estimatedTotal).toBe(36_300_000);
    expect(simulation.estimatedMinimum).toBe(32_670_000);
  });

  it('réutilise une simulation anonyme identique au lieu d’en créer une seconde', async () => {
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 150,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });
    const anonymous = await persistSimulation(snapshot);

    const result = await createOrder(parsePayload({ simulationReference: anonymous.reference }));

    expect(await prisma.simulation.count()).toBe(1);
    expect(result.order.simulationId).toBe(anonymous.id);
    const linked = await prisma.simulation.findUniqueOrThrow({ where: { id: anonymous.id } });
    expect(linked.customerId).not.toBeNull();
  });

  it('crée une nouvelle simulation si la référence transmise ne correspond pas', async () => {
    const snapshot = await computeServerEstimation({
      projectTypeId: referentials.projectTypeId,
      surface: 300,
      cityZoneId: referentials.cityZoneId,
      finishLevelId: referentials.finishLevelId,
    });
    const other = await persistSimulation(snapshot);

    await createOrder(parsePayload({ simulationReference: other.reference, surface: 150 }));
    expect(await prisma.simulation.count()).toBe(2);
  });

  it('regroupe les commandes d’un même client (email + téléphone)', async () => {
    await createOrder(parsePayload());
    await createOrder(parsePayload({ comment: 'Deuxième projet' }));

    expect(await prisma.customer.count()).toBe(1);
    expect(await prisma.order.count()).toBe(2);
  });

  it('refuse la commande lorsque l’option est désactivée', async () => {
    await setSetting(SETTING_KEYS.ORDER_ENABLED, 'false');
    await expect(createOrder(parsePayload())).rejects.toBeInstanceOf(OrderError);
    expect(await prisma.order.count()).toBe(0);
  });

  it('refuse un référentiel désactivé', async () => {
    await prisma.projectType.update({
      where: { id: referentials.projectTypeId },
      data: { active: false },
    });
    await expect(createOrder(parsePayload())).rejects.toThrow(/Type de projet indisponible/);
  });

  it('conserve la commande même si le lien de paiement n’est pas configuré', async () => {
    process.env.WAVE_PAYMENT_URL = '';
    await setSetting(SETTING_KEYS.WAVE_PAYMENT_URL, '');

    const result = await createOrder(parsePayload());
    expect(result.redirectUrl).toBeUndefined();
    expect(result.order.status).toBe('AWAITING_PAYMENT');
    expect(result.payment.status).toBe('PENDING');
  });

  it('privilégie le lien de paiement défini dans l’administration', async () => {
    await setSetting(SETTING_KEYS.WAVE_PAYMENT_URL, 'https://wave.com/pay/kerplus-premium');
    const result = await createOrder(parsePayload());
    expect(result.redirectUrl).toBe('https://wave.com/pay/kerplus-premium');
  });
});

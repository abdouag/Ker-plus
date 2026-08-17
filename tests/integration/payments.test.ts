import { createHmac } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createOrder } from '@/lib/services/orders';
import {
  confirmPaymentManually,
  processPaymentWebhook,
  updatePaymentStatus,
} from '@/lib/services/payments';
import { createOrderSchema } from '@/lib/validation/schemas';
import {
  orderPayload,
  prisma,
  resetDatabase,
  seedReferentials,
  type SeededReferentials,
} from './helpers';

const WEBHOOK_SECRET = 'secret-webhook-de-test';
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

async function createTestOrder() {
  return createOrder(createOrderSchema.parse(orderPayload(referentials)));
}

/** Active le mode API avec une configuration complète et fictive de test. */
function enableApiMode(): void {
  process.env.PAYMENT_PROVIDER = 'wave_api';
  process.env.WAVE_API_BASE_URL = 'https://api.example-test.invalid';
  process.env.WAVE_API_CHECKOUT_PATH = '/v1/checkout/sessions';
  process.env.WAVE_API_KEY = 'cle-de-test';
  process.env.WAVE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.WAVE_WEBHOOK_SIGNATURE_HEADER = 'x-test-signature';
}

function signedRequest(payload: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return { body, headers: new Headers({ 'x-test-signature': signature }) };
}

describe('confirmation manuelle (mode lien de paiement)', () => {
  it('ne confirme jamais un paiement sans action administrateur', async () => {
    const { order, payment } = await createTestOrder();
    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe('PENDING');
    expect(stored.verified).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'AWAITING_PAYMENT',
    );
  });

  it('confirme le paiement, bascule la commande et prépare le rapport', async () => {
    const { order, payment } = await createTestOrder();

    const result = await confirmPaymentManually({
      paymentId: payment.id,
      adminUserId: referentials.adminId,
      externalReference: 'WAVE-TX-123456',
      note: 'Vérifié sur le compte Wave',
    });
    expect(result.alreadyPaid).toBe(false);

    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe('PAID');
    expect(updatedPayment.verified).toBe(true);
    expect(updatedPayment.verifiedById).toBe(referentials.adminId);
    expect(updatedPayment.externalReference).toBe('WAVE-TX-123456');

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('PAID');
    expect(updatedOrder.paidAt).not.toBeNull();

    const report = await prisma.report.findUnique({ where: { orderId: order.id } });
    expect(report?.status).toBe('DRAFT');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'payment.confirm.manual' },
    });
    expect(audit?.adminUserId).toBe(referentials.adminId);
  });

  it('est idempotente : une seconde confirmation ne change rien', async () => {
    const { order, payment } = await createTestOrder();
    await confirmPaymentManually({
      paymentId: payment.id,
      adminUserId: referentials.adminId,
      externalReference: 'WAVE-TX-1',
    });
    const first = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });

    const second = await confirmPaymentManually({
      paymentId: payment.id,
      adminUserId: referentials.adminId,
      externalReference: 'WAVE-TX-2',
    });
    expect(second.alreadyPaid).toBe(true);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paidAt?.toISOString()).toBe(first.paidAt?.toISOString());
    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.externalReference).toBe('WAVE-TX-1');
  });

  it('refuse de confirmer une commande annulée', async () => {
    const { order, payment } = await createTestOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });

    await expect(
      confirmPaymentManually({
        paymentId: payment.id,
        adminUserId: referentials.adminId,
        externalReference: 'WAVE-TX-9',
      }),
    ).rejects.toThrow(/annulée ou remboursée/);
  });

  it('permet de marquer un paiement échoué puis remboursé', async () => {
    const { order, payment } = await createTestOrder();

    await updatePaymentStatus({
      paymentId: payment.id,
      status: 'FAILED',
      adminUserId: referentials.adminId,
      reason: 'Aucun règlement reçu',
    });
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'FAILED',
    );

    await updatePaymentStatus({
      paymentId: payment.id,
      status: 'REFUNDED',
      adminUserId: referentials.adminId,
    });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'REFUNDED',
    );
  });
});

describe('webhooks de paiement', () => {
  it('rejette une notification en mode lien de paiement', async () => {
    const outcome = await processPaymentWebhook('{}', new Headers());
    expect(outcome.status).toBe(400);
    expect(outcome.body.received).toBe(false);
  });

  it('accepte une notification correctement signée et confirme la commande', async () => {
    const { order, payment } = await createTestOrder();
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: 'wave_api', providerTransactionId: 'tx-001' },
    });
    enableApiMode();

    const { body, headers } = signedRequest({
      id: 'tx-001',
      type: 'checkout.session.completed',
      status: 'succeeded',
      amount: order.amount,
      currency: 'XOF',
      client_reference: order.reference,
    });

    const outcome = await processPaymentWebhook(body, headers);
    expect(outcome.status).toBe(200);

    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe('PAID');
    expect(updatedPayment.verified).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('rejette une signature invalide sans modifier la commande', async () => {
    const { order, payment } = await createTestOrder();
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: 'wave_api', providerTransactionId: 'tx-002' },
    });
    enableApiMode();

    const { body } = signedRequest({ id: 'tx-002', status: 'succeeded', amount: order.amount });
    const outcome = await processPaymentWebhook(
      body,
      new Headers({ 'x-test-signature': 'signature-falsifiee' }),
    );

    expect(outcome.status).toBe(400);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'PENDING',
    );
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'AWAITING_PAYMENT',
    );
    expect(await prisma.paymentEvent.count()).toBe(0);
  });

  it('rejette une notification signée avec un autre secret', async () => {
    await createTestOrder();
    enableApiMode();
    const { body, headers } = signedRequest(
      { id: 'tx-003', status: 'succeeded' },
      'mauvais-secret',
    );
    const outcome = await processPaymentWebhook(body, headers);
    expect(outcome.status).toBe(400);
  });

  it('est idempotent : un événement rejoué n’est traité qu’une fois', async () => {
    const { order, payment } = await createTestOrder();
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: 'wave_api', providerTransactionId: 'tx-004' },
    });
    enableApiMode();

    const { body, headers } = signedRequest({
      id: 'tx-004',
      status: 'succeeded',
      amount: order.amount,
      client_reference: order.reference,
    });

    const first = await processPaymentWebhook(body, headers);
    const paidAt = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt;

    const second = await processPaymentWebhook(body, headers);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(await prisma.paymentEvent.count()).toBe(1);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.paidAt?.toISOString()).toBe(paidAt?.toISOString());
  });

  it('refuse un montant divergent de celui de la commande', async () => {
    const { order, payment } = await createTestOrder();
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: 'wave_api', providerTransactionId: 'tx-005' },
    });
    enableApiMode();

    const { body, headers } = signedRequest({
      id: 'tx-005',
      status: 'succeeded',
      amount: 100,
      client_reference: order.reference,
    });

    const outcome = await processPaymentWebhook(body, headers);
    expect(outcome.status).toBe(409);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'PENDING',
    );
  });

  it('accepte la notification sans paiement correspondant sans rien modifier', async () => {
    enableApiMode();
    const { body, headers } = signedRequest({
      id: 'tx-inconnu',
      status: 'succeeded',
      client_reference: 'KP-CMD-20260101-ZZZZ',
    });
    const outcome = await processPaymentWebhook(body, headers);
    expect(outcome.status).toBe(202);
  });

  it('enregistre un échec de paiement notifié', async () => {
    const { order, payment } = await createTestOrder();
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: 'wave_api', providerTransactionId: 'tx-006' },
    });
    enableApiMode();

    const { body, headers } = signedRequest({
      id: 'tx-006',
      status: 'failed',
      amount: order.amount,
      client_reference: order.reference,
    });

    await processPaymentWebhook(body, headers);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe('FAILED');
    expect(updated.verified).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'AWAITING_PAYMENT',
    );
  });
});

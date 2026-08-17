import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import {
  PaymentConfigurationError,
  type PaymentInitContext,
  type PaymentInitResult,
  type PaymentProviderAdapter,
  type WebhookVerificationResult,
} from './types';

/**
 * Mode « API Wave ».
 *
 * ⚠️ Cet adaptateur est volontairement inerte tant que les éléments officiels
 * ne sont pas fournis. Aucune URL, aucun chemin d'API et aucun schéma de
 * signature n'est deviné : tout provient de la configuration.
 *
 * Variables requises avant activation (`PAYMENT_PROVIDER=wave_api`) :
 *   WAVE_API_BASE_URL          — URL de base indiquée par la documentation Wave
 *   WAVE_API_CHECKOUT_PATH     — chemin de création de session de paiement
 *   WAVE_API_KEY               — clé secrète fournie par Wave
 *   WAVE_WEBHOOK_SECRET        — secret de signature des notifications
 *   WAVE_WEBHOOK_SIGNATURE_HEADER — nom de l'en-tête de signature (doc Wave)
 *
 * Les noms de champs de la réponse et du webhook sont eux aussi configurables
 * afin de coller à la documentation officielle sans modification de code.
 */
export class WaveApiAdapter implements PaymentProviderAdapter {
  readonly id = 'wave_api';
  readonly label = 'Wave (API)';
  readonly requiresManualConfirmation = false;

  private get checkoutPath(): string {
    return process.env.WAVE_API_CHECKOUT_PATH ?? '';
  }

  private get signatureHeader(): string {
    return process.env.WAVE_WEBHOOK_SIGNATURE_HEADER ?? '';
  }

  isConfigured(): boolean {
    return Boolean(
      env.payment.waveApiBaseUrl &&
      env.payment.waveApiKey &&
      env.payment.waveWebhookSecret &&
      this.checkoutPath &&
      this.signatureHeader,
    );
  }

  configurationHint(): string {
    const missing = [
      !env.payment.waveApiBaseUrl && 'WAVE_API_BASE_URL',
      !this.checkoutPath && 'WAVE_API_CHECKOUT_PATH',
      !env.payment.waveApiKey && 'WAVE_API_KEY',
      !env.payment.waveWebhookSecret && 'WAVE_WEBHOOK_SECRET',
      !this.signatureHeader && 'WAVE_WEBHOOK_SIGNATURE_HEADER',
    ].filter(Boolean);
    return (
      'Intégration API Wave non configurée. Renseignez, à partir de la documentation ' +
      `officielle Wave : ${missing.join(', ')}.`
    );
  }

  async createPayment(context: PaymentInitContext): Promise<PaymentInitResult> {
    if (!this.isConfigured()) {
      throw new PaymentConfigurationError(this.configurationHint());
    }

    const endpoint = new URL(this.checkoutPath, env.payment.waveApiBaseUrl).toString();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.payment.waveApiKey}`,
        'content-type': 'application/json',
        'idempotency-key': context.orderReference,
      },
      body: JSON.stringify({
        amount: context.amount,
        currency: context.currency,
        client_reference: context.orderReference,
        success_url: context.returnUrl,
        error_url: context.cancelUrl,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      // Le corps de la réponse peut contenir des informations sensibles :
      // on ne journalise que le statut HTTP.
      console.error('[wave_api] création de paiement refusée', { status: response.status });
      throw new PaymentConfigurationError(
        `Le fournisseur de paiement a refusé la demande (HTTP ${response.status}).`,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const redirectField = process.env.WAVE_API_RESPONSE_URL_FIELD ?? 'wave_launch_url';
    const idField = process.env.WAVE_API_RESPONSE_ID_FIELD ?? 'id';

    const redirectUrl =
      typeof data[redirectField] === 'string' ? (data[redirectField] as string) : undefined;
    if (!redirectUrl) {
      throw new PaymentConfigurationError(
        `Réponse Wave inattendue : champ « ${redirectField} » absent. ` +
          'Ajustez WAVE_API_RESPONSE_URL_FIELD selon la documentation officielle.',
      );
    }

    return {
      provider: this.id,
      status: 'PROCESSING',
      redirectUrl,
      providerTransactionId:
        typeof data[idField] === 'string' ? (data[idField] as string) : undefined,
      metadata: { mode: 'api' },
    };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult> {
    if (!this.isConfigured()) {
      return { valid: false, reason: this.configurationHint() };
    }

    const provided = headers.get(this.signatureHeader);
    if (!provided) {
      return { valid: false, reason: 'En-tête de signature absent.' };
    }

    const expected = createHmac('sha256', env.payment.waveWebhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    // La signature peut être transmise préfixée (« sha256=… ») selon le
    // fournisseur : on compare la partie hexadécimale.
    const candidate = provided.includes('=') ? (provided.split('=').pop() ?? '') : provided;
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const candidateBuffer = Buffer.from(candidate.trim(), 'utf8');
    const valid =
      expectedBuffer.length === candidateBuffer.length &&
      timingSafeEqual(expectedBuffer, candidateBuffer);

    if (!valid) {
      return { valid: false, reason: 'Signature du webhook invalide.' };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return { valid: false, reason: 'Corps de notification illisible.' };
    }

    const readString = (key: string): string | undefined =>
      typeof payload[key] === 'string' ? (payload[key] as string) : undefined;

    const statusRaw = (readString('status') ?? '').toLowerCase();
    const status =
      statusRaw === 'succeeded' || statusRaw === 'success' || statusRaw === 'complete'
        ? ('PAID' as const)
        : statusRaw === 'failed' || statusRaw === 'error'
          ? ('FAILED' as const)
          : statusRaw === 'cancelled' || statusRaw === 'canceled'
            ? ('CANCELLED' as const)
            : ('PROCESSING' as const);

    return {
      valid: true,
      eventId: readString('id') ?? readString('event_id') ?? '',
      eventType: readString('type') ?? 'payment.update',
      providerTransactionId: readString('id'),
      externalReference: readString('client_reference'),
      orderReference: readString('client_reference'),
      amount:
        typeof payload.amount === 'number' ? payload.amount : Number(payload.amount) || undefined,
      currency: readString('currency'),
      status,
      payload,
    };
  }
}

import type { PaymentStatus } from '@prisma/client';

/**
 * Contrat d'adaptateur de paiement.
 *
 * Ajouter Orange Money, une carte bancaire, PayDunya ou pawaPay revient à
 * implémenter cette interface et à l'enregistrer dans `registry.ts` : aucune
 * logique métier ne dépend d'un fournisseur particulier.
 */

export interface PaymentInitContext {
  orderReference: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** URL de retour client après paiement. */
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentInitResult {
  provider: string;
  status: PaymentStatus;
  /** URL vers laquelle rediriger le client, si le fournisseur en fournit une. */
  redirectUrl?: string;
  /** Identifiant de transaction côté fournisseur, si disponible immédiatement. */
  providerTransactionId?: string;
  /** Instructions affichées au client (mode lien de paiement). */
  instructions?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  /** Signature vérifiée avec le secret configuré. */
  valid: boolean;
  reason?: string;
  /** Identifiant unique de l'événement, utilisé pour garantir l'idempotence. */
  eventId?: string;
  eventType?: string;
  providerTransactionId?: string;
  externalReference?: string;
  /** Référence de commande transmise par le fournisseur, si disponible. */
  orderReference?: string;
  amount?: number;
  currency?: string;
  status?: PaymentStatus;
  payload?: unknown;
}

export interface PaymentProviderAdapter {
  /** Identifiant technique persisté dans `Payment.provider`. */
  readonly id: string;
  readonly label: string;
  /**
   * Vrai lorsque le paiement ne peut pas être confirmé automatiquement et
   * nécessite une vérification humaine côté Kerplus.
   */
  readonly requiresManualConfirmation: boolean;
  /** Vrai lorsque toutes les variables nécessaires sont renseignées. */
  isConfigured(): boolean;
  /** Message expliquant ce qui manque lorsque `isConfigured()` est faux. */
  configurationHint(): string;
  createPayment(context: PaymentInitContext): Promise<PaymentInitResult>;
  /** Vérifie une notification entrante. Les adaptateurs sans webhook renvoient `valid: false`. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerificationResult>;
}

export class PaymentConfigurationError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'PaymentConfigurationError';
  }
}

import 'server-only';

import { env } from '@/lib/env';
import { getSettingString, SETTING_KEYS } from '@/lib/settings';
import {
  PaymentConfigurationError,
  type PaymentInitContext,
  type PaymentInitResult,
  type PaymentProviderAdapter,
  type WebhookVerificationResult,
} from './types';

/**
 * Mode « lien de paiement Wave ».
 *
 * Kerplus dispose uniquement d'une URL de collecte publique. Ce mode :
 *  - redirige le client vers le lien Wave configuré ;
 *  - laisse le paiement au statut PENDING ;
 *  - ne confirme JAMAIS la commande sur simple retour du navigateur ;
 *  - impose une vérification manuelle par un administrateur.
 *
 * Aucune URL, route ou signature Wave n'est inventée ici : le lien provient
 * exclusivement du paramètre administrable ou de la variable d'environnement
 * WAVE_PAYMENT_URL.
 */
export class WaveLinkAdapter implements PaymentProviderAdapter {
  readonly id = 'wave_link';
  readonly label = 'Wave (lien de paiement)';
  readonly requiresManualConfirmation = true;

  /** Le paramètre administrable est prioritaire sur la variable d'environnement. */
  private async resolveUrl(): Promise<string> {
    const fromSettings = await getSettingString(SETTING_KEYS.WAVE_PAYMENT_URL, '');
    return fromSettings || env.payment.wavePaymentUrl;
  }

  isConfigured(): boolean {
    // Vérification synchrone : ne couvre que la variable d'environnement.
    // Le paramètre en base est résolu au moment de la création du paiement.
    return Boolean(env.payment.wavePaymentUrl);
  }

  configurationHint(): string {
    return 'Renseignez le lien de paiement Wave (variable WAVE_PAYMENT_URL ou paramètre « Lien de paiement Wave » dans l’administration).';
  }

  async createPayment(context: PaymentInitContext): Promise<PaymentInitResult> {
    const url = await this.resolveUrl();
    if (!url) {
      throw new PaymentConfigurationError(this.configurationHint());
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new PaymentConfigurationError(
        'Le lien de paiement Wave configuré n’est pas une URL valide.',
      );
    }
    if (parsed.protocol !== 'https:') {
      throw new PaymentConfigurationError('Le lien de paiement Wave doit utiliser HTTPS.');
    }

    return {
      provider: this.id,
      status: 'PENDING',
      redirectUrl: parsed.toString(),
      instructions:
        `Montant à régler : ${context.amount} FCFA. Indiquez la référence ${context.orderReference} ` +
        'lors du paiement, puis transmettez-nous l’identifiant de la transaction Wave. ' +
        'Votre commande sera confirmée après vérification par notre équipe.',
      metadata: {
        mode: 'payment_link',
        orderReference: context.orderReference,
      },
    };
  }

  async verifyWebhook(): Promise<WebhookVerificationResult> {
    return {
      valid: false,
      reason:
        'Le mode lien de paiement ne reçoit aucune notification Wave. La confirmation est manuelle.',
    };
  }
}

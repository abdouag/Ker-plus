import 'server-only';

import { env } from '@/lib/env';
import type { PaymentProviderAdapter } from './types';
import { WaveLinkAdapter } from './wave-link';
import { WaveApiAdapter } from './wave-api';

/**
 * Registre des adaptateurs de paiement.
 * Pour ajouter Orange Money, PayDunya, pawaPay ou une carte bancaire :
 * implémenter `PaymentProviderAdapter` puis enregistrer l'instance ci-dessous.
 */
const adapters: PaymentProviderAdapter[] = [new WaveLinkAdapter(), new WaveApiAdapter()];

const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));

export function listPaymentProviders(): PaymentProviderAdapter[] {
  return [...adapters];
}

export function getPaymentProvider(id?: string): PaymentProviderAdapter {
  const key = id ?? env.payment.provider;
  const adapter = byId.get(key);
  if (!adapter) {
    // Repli sûr : le mode lien n'engage jamais de confirmation automatique.
    console.warn(`[payments] fournisseur inconnu « ${key} », repli sur wave_link`);
    return byId.get('wave_link') as PaymentProviderAdapter;
  }
  return adapter;
}

export function getActivePaymentProvider(): PaymentProviderAdapter {
  return getPaymentProvider(env.payment.provider);
}

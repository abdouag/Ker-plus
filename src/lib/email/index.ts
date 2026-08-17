import 'server-only';

import { env } from '@/lib/env';
import { PreviewEmailProvider } from './preview';
import { SmtpEmailProvider } from './smtp';
import type { EmailMessage, EmailProvider, EmailSendResult } from './types';

export * from './types';

let provider: EmailProvider | null = null;

/**
 * Sélection du fournisseur email.
 * Par défaut — et dès qu'une configuration SMTP est incomplète — on retombe
 * sur le mode prévisualisation : jamais d'envoi accidentel.
 */
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  if (env.email.provider === 'smtp' && env.email.smtp.host) {
    provider = new SmtpEmailProvider();
  } else {
    if (env.email.provider === 'smtp') {
      console.warn('[email] SMTP demandé mais SMTP_HOST absent : mode prévisualisation activé.');
    }
    provider = new PreviewEmailProvider();
  }
  return provider;
}

/** Envoi tolérant aux pannes : un échec d'email n'annule jamais une commande. */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  try {
    return await getEmailProvider().send(message);
  } catch (error) {
    console.error('[email] envoi impossible', {
      subject: message.subject,
      message: error instanceof Error ? error.message : 'erreur inconnue',
    });
    return { delivered: false, provider: 'unknown', error: 'Envoi impossible.' };
  }
}

/** Réinitialise le fournisseur mémorisé (tests). */
export function resetEmailProvider(): void {
  provider = null;
}

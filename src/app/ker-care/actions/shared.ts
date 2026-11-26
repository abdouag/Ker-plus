import 'server-only';

import { AuthorizationError } from '@/lib/auth/guard';
import { CsrfError } from '@/lib/security/csrf';
import { CareError } from '@/lib/care/errors';
import { TransitionError } from '@/lib/care/workflow';
import { QuoteValidationError } from '@/lib/care/quote';
import { consumeRateLimit, type RateLimitOptions } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request';

/** État renvoyé par les actions Kër Care (client et prestataire). */
export interface CareActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export function toCareActionState(error: unknown, context: string): CareActionState {
  if (
    error instanceof CareError ||
    error instanceof TransitionError ||
    error instanceof QuoteValidationError ||
    error instanceof AuthorizationError ||
    error instanceof CsrfError
  ) {
    return { ok: false, error: error.message };
  }
  console.error(`[ker-care] ${context}`, {
    message: error instanceof Error ? error.message : 'erreur inconnue',
  });
  return {
    ok: false,
    error: 'L’opération a échoué. Vérifiez votre connexion puis réessayez.',
  };
}

export async function assertRateLimit(bucket: string, options: RateLimitOptions): Promise<void> {
  const ip = await getClientIp();
  const result = consumeRateLimit(`${bucket}:${ip}`, options);
  if (!result.allowed) {
    throw new CareError(
      `Trop de tentatives. Réessayez dans ${Math.ceil(result.retryAfterSeconds / 60)} minute(s).`,
      429,
    );
  }
}

/** Lecture de champs texte bornés. */
export function text(formData: FormData, name: string, max = 4000): string {
  return String(formData.get(name) ?? '')
    .trim()
    .slice(0, max);
}

/** Objet brut des champs simples, pour validation Zod. */
export function fields(formData: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, text(formData, name)]));
}

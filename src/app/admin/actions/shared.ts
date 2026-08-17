import 'server-only';

import { AuthorizationError } from '@/lib/auth/guard';
import { CsrfError } from '@/lib/security/csrf';
import { OrderError } from '@/lib/services/orders';
import { PaymentError } from '@/lib/services/payments';
import { ReportError } from '@/lib/services/reports';

/** État renvoyé par toutes les actions d'administration. */
export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Convertit une exception en message utilisateur.
 * Les erreurs inattendues sont journalisées sans divulguer de détail technique.
 */
export function toActionState(error: unknown, context: string): ActionState {
  if (
    error instanceof CsrfError ||
    error instanceof AuthorizationError ||
    error instanceof OrderError ||
    error instanceof PaymentError ||
    error instanceof ReportError
  ) {
    return { ok: false, error: error.message };
  }

  console.error(`[admin] ${context}`, {
    message: error instanceof Error ? error.message : 'erreur inconnue',
  });
  return { ok: false, error: 'L’opération a échoué. Réessayez ou contactez le support technique.' };
}

/** Lecture d'un champ texte de formulaire, borné en longueur. */
export function readText(formData: FormData, name: string, maxLength = 8000): string {
  return String(formData.get(name) ?? '')
    .trim()
    .slice(0, maxLength);
}

/** Lecture d'un entier de formulaire. */
export function readInt(formData: FormData, name: string, fallback = 0): number {
  const raw = String(formData.get(name) ?? '').replace(/[^\d-]/g, '');
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readBool(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true' || value === '1';
}

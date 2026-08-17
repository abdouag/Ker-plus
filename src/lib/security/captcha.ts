import 'server-only';

import { env } from '@/lib/env';

/**
 * Vérification CAPTCHA optionnelle et configurable.
 * Tant qu'aucun fournisseur n'est configuré, la vérification est neutre :
 * la protection anti-spam repose alors sur le honeypot et le rate limiting.
 *
 * Seul Cloudflare Turnstile est câblé pour l'instant ; ajouter un fournisseur
 * revient à étendre le `switch` ci-dessous.
 */

export interface CaptchaResult {
  ok: boolean;
  reason?: string;
}

export function isCaptchaEnabled(): boolean {
  return Boolean(env.security.captchaProvider && env.security.captchaSecretKey);
}

export async function verifyCaptcha(token: string | undefined, ip: string): Promise<CaptchaResult> {
  if (!isCaptchaEnabled()) return { ok: true };
  if (!token) return { ok: false, reason: 'Jeton CAPTCHA manquant.' };

  switch (env.security.captchaProvider) {
    case 'turnstile': {
      try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: env.security.captchaSecretKey,
            response: token,
            remoteip: ip,
          }),
        });
        const data = (await response.json()) as { success?: boolean };
        return data.success ? { ok: true } : { ok: false, reason: 'Vérification CAPTCHA échouée.' };
      } catch {
        // Un fournisseur indisponible ne doit pas bloquer les commandes.
        console.warn('[captcha] fournisseur injoignable, vérification ignorée');
        return { ok: true };
      }
    }
    default:
      console.warn(`[captcha] fournisseur inconnu : ${env.security.captchaProvider}`);
      return { ok: true };
  }
}

import 'server-only';

import { cookies } from 'next/headers';
import { CSRF_COOKIE } from '@/lib/auth/session';
import { safeEqual } from './request';
import { CSRF_FIELD } from './csrf-field';

/**
 * Protection CSRF par double soumission.
 *
 * Le middleware dépose un jeton aléatoire dans un cookie HttpOnly pour toutes
 * les routes /admin. Les formulaires réinjectent ce jeton dans un champ caché ;
 * les actions serveur comparent les deux valeurs à temps constant.
 */

export { CSRF_FIELD };

export async function getCsrfToken(): Promise<string> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? '';
}

export class CsrfError extends Error {
  readonly status = 403;
  constructor() {
    super('Jeton de sécurité invalide ou expiré. Rechargez la page et réessayez.');
    this.name = 'CsrfError';
  }
}

export async function assertCsrf(formData: FormData): Promise<void> {
  const submitted = String(formData.get(CSRF_FIELD) ?? '');
  const expected = await getCsrfToken();
  if (!expected || !submitted || !safeEqual(submitted, expected)) {
    throw new CsrfError();
  }
}

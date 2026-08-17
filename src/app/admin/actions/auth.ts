'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation/schemas';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session';
import { assertCsrf, CsrfError } from '@/lib/security/csrf';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request';
import { recordAudit } from '@/lib/audit';

export interface LoginState {
  error?: string;
}

/**
 * Authentification administrateur.
 *
 * Le message d'erreur reste volontairement identique quel que soit le motif
 * (email inconnu, mot de passe invalide, compte désactivé) afin de ne pas
 * révéler l'existence d'un compte.
 */
export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const genericError = 'Identifiants invalides.';

  try {
    await assertCsrf(formData);
  } catch (error) {
    return { error: error instanceof CsrfError ? error.message : genericError };
  }

  const ip = await getClientIp();
  const limit = consumeRateLimit(`login:${ip}`, RATE_LIMITS.login);
  if (!limit.allowed) {
    return {
      error: `Trop de tentatives. Réessayez dans ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: genericError };
  }

  const user = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  const passwordValid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : // Comparaison factice : évite de révéler l'inexistence du compte par le temps de réponse.
      await verifyPassword(
        parsed.data.password,
        '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
      );

  if (!user || !user.active || !passwordValid) {
    await recordAudit({
      action: 'admin.login.failed',
      entityType: 'AdminUser',
      entityId: user?.id ?? null,
      after: { email: parsed.data.email },
    });
    return { error: genericError };
  }

  const token = await createSessionToken(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    env.authSecret(),
    env.sessionMaxAge,
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(env.sessionMaxAge, env.isProduction));

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit({
    adminUserId: user.id,
    action: 'admin.login.success',
    entityType: 'AdminUser',
    entityId: user.id,
  });

  const next = String(formData.get('next') ?? '');
  redirect(next.startsWith('/admin') ? next : '/admin/dashboard');
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/admin/login');
}

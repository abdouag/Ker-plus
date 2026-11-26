'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_MAX_AGE,
  createAccountToken,
} from '@/lib/auth/account-session';
import { sessionCookieOptions } from '@/lib/auth/session';
import { assertCsrf } from '@/lib/security/csrf';
import { RATE_LIMITS } from '@/lib/security/rate-limit';
import { getSettingBool, SETTING_KEYS } from '@/lib/settings';
import { accountLoginSchema, firstIssue, signupSchema } from '@/lib/care/validation';
import { createClientAccount } from '@/lib/care/services/accounts';
import { CareError } from '@/lib/care/errors';
import {
  assertRateLimit,
  text,
  toCareActionState,
  type CareActionState,
} from '@/app/ker-care/actions/shared';

/** Seules les redirections internes vers les espaces Kër Care sont suivies. */
function safeNext(value: string, role: string): string {
  if (role === 'PROVIDER') {
    return value.startsWith('/ker-care/prestataire') ? value : '/ker-care/prestataire';
  }
  return value.startsWith('/ker-care/') && !value.startsWith('/ker-care/prestataire')
    ? value
    : '/ker-care/mon-espace';
}

async function openSession(accountId: string, role: string): Promise<void> {
  const token = await createAccountToken({ sub: accountId, role }, env.authSecret());
  const store = await cookies();
  store.set(
    ACCOUNT_SESSION_COOKIE,
    token,
    sessionCookieOptions(ACCOUNT_SESSION_MAX_AGE, env.isProduction),
  );
}

export async function signupAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  let target = '/ker-care/mon-espace';
  try {
    await assertCsrf(formData);
    await assertRateLimit('signup', RATE_LIMITS.signup);
    if (!(await getSettingBool(SETTING_KEYS.CARE_SIGNUP_ENABLED, true))) {
      throw new CareError('La création de compte est momentanément fermée.', 503);
    }
    const parsed = signupSchema.safeParse({
      name: text(formData, 'name', 120),
      email: text(formData, 'email', 160),
      phone: text(formData, 'phone', 40),
      password: String(formData.get('password') ?? ''),
      consent: formData.get('consent') === 'on',
    });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const account = await createClientAccount(parsed.data);
    await openSession(account.id, account.role);
    target = safeNext(text(formData, 'next', 300), account.role);
  } catch (error) {
    return toCareActionState(error, 'inscription');
  }
  redirect(target);
}

export async function accountLoginAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  const genericError = 'Email ou mot de passe incorrect.';
  let target: string;
  try {
    await assertCsrf(formData);
    await assertRateLimit('account-login', RATE_LIMITS.login);
    const parsed = accountLoginSchema.safeParse({
      email: text(formData, 'email', 160),
      password: String(formData.get('password') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: genericError };

    const account = await prisma.account.findUnique({ where: { email: parsed.data.email } });
    const valid = account
      ? await verifyPassword(parsed.data.password, account.passwordHash)
      : await verifyPassword(
          parsed.data.password,
          '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
        );
    if (!account || !account.active || !valid) return { ok: false, error: genericError };

    await prisma.account.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    await openSession(account.id, account.role);
    target = safeNext(text(formData, 'next', 300), account.role);
  } catch (error) {
    return toCareActionState(error, 'connexion compte');
  }
  redirect(target);
}

export async function accountLogoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ACCOUNT_SESSION_COOKIE);
  redirect('/ker-care');
}

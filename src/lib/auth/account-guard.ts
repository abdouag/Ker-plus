import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Account, ProviderProfile } from '@prisma/client';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_SESSION_COOKIE, verifyAccountToken } from './account-session';
import { AuthorizationError } from './guard';

export type SessionAccount = Pick<Account, 'id' | 'name' | 'email' | 'phone' | 'role' | 'active'> & {
  providerProfile: Pick<ProviderProfile, 'id' | 'verificationStatus'> | null;
};

/**
 * Compte public connecté, relu en base (rôle et état actif) à chaque appel.
 */
export async function getCurrentAccount(): Promise<SessionAccount | null> {
  const store = await cookies();
  const token = store.get(ACCOUNT_SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyAccountToken(token, env.authSecret());
  if (!payload) return null;

  const account = await prisma.account.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      providerProfile: { select: { id: true, verificationStatus: true } },
    },
  });
  if (!account || !account.active) return null;
  return account;
}

function loginUrl(returnTo: string): string {
  return `/compte/connexion?next=${encodeURIComponent(returnTo)}`;
}

/** Garde de page client : redirige vers la connexion, ou vers l'espace prestataire. */
export async function requireClientPage(returnTo: string): Promise<SessionAccount> {
  const account = await getCurrentAccount();
  if (!account) redirect(loginUrl(returnTo));
  if (account.role !== 'CLIENT') redirect('/ker-care/prestataire');
  return account;
}

export async function requireProviderPage(returnTo: string): Promise<
  SessionAccount & { providerProfile: NonNullable<SessionAccount['providerProfile']> }
> {
  const account = await getCurrentAccount();
  if (!account) redirect(loginUrl(returnTo));
  if (account.role !== 'PROVIDER' || !account.providerProfile) redirect('/ker-care/mon-espace');
  return account as SessionAccount & {
    providerProfile: NonNullable<SessionAccount['providerProfile']>;
  };
}

/** Garde d'action serveur — client. */
export async function requireClient(): Promise<SessionAccount> {
  const account = await getCurrentAccount();
  if (!account) throw new AuthorizationError('Connectez-vous pour continuer.');
  if (account.role !== 'CLIENT') {
    throw new AuthorizationError('Cette action est réservée aux comptes clients.');
  }
  return account;
}

/** Garde d'action serveur — prestataire (profil obligatoire). */
export async function requireProvider(): Promise<{ account: SessionAccount; providerId: string }> {
  const account = await getCurrentAccount();
  if (!account) throw new AuthorizationError('Connectez-vous pour continuer.');
  if (account.role !== 'PROVIDER' || !account.providerProfile) {
    throw new AuthorizationError('Cette action est réservée aux prestataires Kër Care.');
  }
  return { account, providerId: account.providerProfile.id };
}

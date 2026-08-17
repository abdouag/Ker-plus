import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminRole, AdminUser } from '@prisma/client';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from './session';

export type AdminSessionUser = Pick<AdminUser, 'id' | 'name' | 'email' | 'role' | 'active'>;

/**
 * Retourne l'administrateur connecté, ou `null`.
 * Le rôle et l'état actif sont systématiquement relus en base : un compte
 * désactivé perd immédiatement l'accès, même si son cookie reste valide.
 */
export async function getCurrentAdmin(): Promise<AdminSessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token, env.authSecret());
  if (!payload) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (!user || !user.active) return null;
  return user;
}

/** Garde de page : redirige vers /admin/login si la session est absente. */
export async function requireAdmin(returnTo?: string): Promise<AdminSessionUser> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    const target = returnTo ? `/admin/login?next=${encodeURIComponent(returnTo)}` : '/admin/login';
    redirect(target);
  }
  return admin;
}

const ROLE_WEIGHT: Record<AdminRole, number> = {
  VIEWER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasRole(user: AdminSessionUser, minimum: AdminRole): boolean {
  return ROLE_WEIGHT[user.role] >= ROLE_WEIGHT[minimum];
}

/** Garde d'action serveur : lève une erreur si le rôle est insuffisant. */
export async function requireRole(minimum: AdminRole): Promise<AdminSessionUser> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new AuthorizationError('Session administrateur requise.');
  }
  if (!hasRole(admin, minimum)) {
    throw new AuthorizationError("Vous n'avez pas les droits nécessaires pour cette action.");
  }
  return admin;
}

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

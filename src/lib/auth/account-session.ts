import { SignJWT, jwtVerify } from 'jose';

/**
 * Sessions des comptes publics Kër+ (clients et prestataires Kër Care).
 *
 * Distinctes des sessions administrateur : cookie, audience et durée propres.
 * Le jeton ne contient que l'identité et le rôle, revérifiés en base à chaque
 * requête. Compatible Edge (middleware) : aucun import Prisma ni bcrypt.
 */

export const ACCOUNT_SESSION_COOKIE = 'kerplus_account_session';
export const ACCOUNT_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ISSUER = 'kerplus-estimateur';
const AUDIENCE = 'kerplus-account';

export interface AccountSessionPayload {
  sub: string;
  role: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createAccountToken(
  payload: AccountSessionPayload,
  secret: string,
  maxAgeSeconds: number = ACCOUNT_SESSION_MAX_AGE,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + maxAgeSeconds)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(key(secret));
}

export async function verifyAccountToken(
  token: string,
  secret: string,
): Promise<AccountSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub || typeof payload.role !== 'string') return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

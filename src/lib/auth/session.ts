import { SignJWT, jwtVerify } from 'jose';

/**
 * Sessions administrateur : JWT signé (HS256) déposé dans un cookie
 * HttpOnly + Secure + SameSite=Lax. Aucune donnée sensible n'y est stockée,
 * uniquement l'identité et le rôle, revérifiés en base à chaque requête.
 *
 * Ce module est compatible Edge (middleware) : il n'importe ni Prisma ni bcrypt.
 */

export const SESSION_COOKIE = 'kerplus_admin_session';
export const CSRF_COOKIE = 'kerplus_csrf';

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
  secret: string,
  maxAgeSeconds: number,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: payload.email, role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + maxAgeSeconds)
    .setIssuer('kerplus-estimateur')
    .setAudience('kerplus-admin')
    .sign(secretKey(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: 'kerplus-estimateur',
      audience: 'kerplus-admin',
    });
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds: number, secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

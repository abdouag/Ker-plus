import { beforeEach, describe, expect, it } from 'vitest';
import { consumeRateLimit, resetRateLimits } from '@/lib/security/rate-limit';
import { extractIp, hashIp, maskSensitive, safeEqual } from '@/lib/security/request';
import { sanitizeForAudit } from '@/lib/audit';
import { checkPasswordStrength, hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSessionToken, verifySessionToken, sessionCookieOptions } from '@/lib/auth/session';

const SECRET = 'secret-de-test-suffisamment-long-pour-hs256';

describe('rate limiting', () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.RATE_LIMIT_ENABLED = 'true';
  });

  it('autorise puis bloque au-delà de la limite', () => {
    const options = { limit: 3, windowSeconds: 60 };
    expect(consumeRateLimit('ip-a', options).allowed).toBe(true);
    expect(consumeRateLimit('ip-a', options).allowed).toBe(true);
    expect(consumeRateLimit('ip-a', options).allowed).toBe(true);

    const blocked = consumeRateLimit('ip-a', options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('isole les compartiments', () => {
    const options = { limit: 1, windowSeconds: 60 };
    expect(consumeRateLimit('ip-b', options).allowed).toBe(true);
    expect(consumeRateLimit('ip-c', options).allowed).toBe(true);
    expect(consumeRateLimit('ip-b', options).allowed).toBe(false);
  });

  it('réautorise après expiration de la fenêtre', () => {
    const options = { limit: 1, windowSeconds: 60 };
    const start = 1_000_000;
    expect(consumeRateLimit('ip-d', options, start).allowed).toBe(true);
    expect(consumeRateLimit('ip-d', options, start + 1_000).allowed).toBe(false);
    expect(consumeRateLimit('ip-d', options, start + 61_000).allowed).toBe(true);
  });

  it('peut être désactivé par configuration', () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    const options = { limit: 1, windowSeconds: 60 };
    expect(consumeRateLimit('ip-e', options).allowed).toBe(true);
    expect(consumeRateLimit('ip-e', options).allowed).toBe(true);
    process.env.RATE_LIMIT_ENABLED = 'false';
  });
});

describe('traitement des adresses IP', () => {
  it('extrait l’IP derrière un proxy', () => {
    const headers = new Headers({ 'x-forwarded-for': '196.1.2.3, 10.0.0.1' });
    expect(extractIp(headers)).toBe('196.1.2.3');
    expect(extractIp(new Headers({ 'x-real-ip': '41.82.1.9' }))).toBe('41.82.1.9');
    expect(extractIp(new Headers())).toBe('unknown');
  });

  it('produit une empreinte stable et non réversible', () => {
    const hash = hashIp('196.1.2.3');
    expect(hash).toHaveLength(40);
    expect(hash).not.toContain('196');
    expect(hashIp('196.1.2.3')).toBe(hash);
    expect(hashIp('196.1.2.4')).not.toBe(hash);
  });
});

describe('utilitaires de sécurité', () => {
  it('compare à temps constant sans lever d’exception', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('masque les données sensibles', () => {
    expect(maskSensitive('client@example.com')).toBe('cl****om');
    expect(maskSensitive('abc')).toBe('****');
    expect(maskSensitive(null)).toBe('');
  });

  it('retire les secrets des journaux d’audit', () => {
    const sanitized = sanitizeForAudit({
      email: 'client@example.com',
      passwordHash: '$2a$12$abcdef',
      secureTokenHash: 'aaa',
      nested: { apiKey: 'sk-test', amount: 50_000 },
    }) as Record<string, unknown>;

    expect(sanitized.passwordHash).toBe('[masqué]');
    expect(sanitized.secureTokenHash).toBe('[masqué]');
    expect((sanitized.nested as Record<string, unknown>).apiKey).toBe('[masqué]');
    expect((sanitized.nested as Record<string, unknown>).amount).toBe(50_000);
    expect(sanitized.email).toBe('client@example.com');
  });
});

describe('mots de passe administrateur', () => {
  it('impose une politique minimale', () => {
    expect(checkPasswordStrength('court').valid).toBe(false);
    expect(checkPasswordStrength('motdepasseminuscule').valid).toBe(false);
    expect(checkPasswordStrength('MotDePasseSansChiffre').valid).toBe(false);
    expect(checkPasswordStrength('MotDePasse2026!').valid).toBe(true);
  });

  it('hache et vérifie un mot de passe', async () => {
    const hash = await hashPassword('MotDePasse2026!');
    expect(hash).not.toContain('MotDePasse');
    expect(await verifyPassword('MotDePasse2026!', hash)).toBe(true);
    expect(await verifyPassword('MauvaisMotDePasse1', hash)).toBe(false);
    expect(await verifyPassword('MotDePasse2026!', '')).toBe(false);
    expect(await verifyPassword('MotDePasse2026!', 'pas-un-hash')).toBe(false);
  });
});

describe('sessions administrateur', () => {
  const payload = { sub: 'admin-1', email: 'admin@kerplus.sn', role: 'ADMIN', name: 'Admin' };

  it('émet et vérifie un jeton', async () => {
    const token = await createSessionToken(payload, SECRET, 3600);
    expect(await verifySessionToken(token, SECRET)).toMatchObject(payload);
  });

  it('rejette un jeton signé avec un autre secret', async () => {
    const token = await createSessionToken(payload, SECRET, 3600);
    expect(await verifySessionToken(token, `${SECRET}-autre`)).toBeNull();
  });

  it('rejette un jeton altéré', async () => {
    const token = await createSessionToken(payload, SECRET, 3600);
    const [header, , signature] = token.split('.');
    const tampered = `${header}.${Buffer.from(
      JSON.stringify({ ...payload, role: 'SUPERADMIN' }),
    ).toString('base64url')}.${signature}`;
    expect(await verifySessionToken(tampered, SECRET)).toBeNull();
    expect(await verifySessionToken(`${token}x`, SECRET)).toBeNull();
    expect(await verifySessionToken('', SECRET)).toBeNull();
  });

  it('rejette un jeton expiré', async () => {
    const token = await createSessionToken(payload, SECRET, -10);
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it('produit un cookie HttpOnly, SameSite et Secure en production', () => {
    const options = sessionCookieOptions(3600, true);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });
  });
});

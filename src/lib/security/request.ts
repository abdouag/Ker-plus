import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Extraction de l'adresse IP appelante derrière un proxy/CDN.
 * L'IP brute n'est jamais persistée : seule une empreinte salée est stockée.
 */
export function extractIp(requestHeaders: Headers): string {
  const forwarded = requestHeaders.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    requestHeaders.get('x-real-ip') ??
    requestHeaders.get('cf-connecting-ip') ??
    requestHeaders.get('x-vercel-forwarded-for') ??
    'unknown'
  );
}

export async function getClientIp(): Promise<string> {
  return extractIp(await headers());
}

/** Empreinte SHA-256 salée par AUTH_SECRET — non réversible, non corrélable. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${env.authSecret()}:${ip}`).digest('hex').slice(0, 40);
}

export async function getHashedClientIp(): Promise<string> {
  return hashIp(await getClientIp());
}

export async function getUserAgent(): Promise<string> {
  const value = (await headers()).get('user-agent') ?? '';
  return value.slice(0, 250);
}

/** Comparaison à temps constant de deux chaînes (jetons, signatures). */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Masque une donnée sensible dans les journaux : « ab****yz ». */
export function maskSensitive(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

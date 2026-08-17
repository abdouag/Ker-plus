import 'server-only';

import { env } from '@/lib/env';

/**
 * Limitation de fréquence en mémoire (fenêtre glissante par compartiment).
 *
 * Suffisant pour une instance unique. En déploiement multi-instances,
 * remplacer `store` par un backend partagé (Redis) : l'interface publique
 * `consumeRateLimit` reste inchangée.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRateLimit = globalThis as unknown as { kerplusRateLimit?: Map<string, Bucket> };
const store: Map<string, Bucket> = globalForRateLimit.kerplusRateLimit ?? new Map();
globalForRateLimit.kerplusRateLimit = store;

export interface RateLimitOptions {
  /** Nombre maximal d'opérations autorisées dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export const RATE_LIMITS = {
  estimate: { limit: 60, windowSeconds: 60 },
  order: { limit: 8, windowSeconds: 600 },
  login: { limit: 8, windowSeconds: 900 },
  download: { limit: 30, windowSeconds: 300 },
  webhook: { limit: 240, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitOptions>;

function purge(now: number): void {
  if (store.size < 5_000) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export function consumeRateLimit(
  identifier: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  if (!env.security.rateLimitEnabled) {
    return { allowed: true, remaining: options.limit, retryAfterSeconds: 0 };
  }

  purge(now);
  const bucket = store.get(identifier);

  if (!bucket || bucket.resetAt <= now) {
    store.set(identifier, { count: 1, resetAt: now + options.windowSeconds * 1000 });
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: options.limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

/** Réinitialisation — utilisée par les tests. */
export function resetRateLimits(): void {
  store.clear();
}

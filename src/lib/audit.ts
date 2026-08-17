import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getHashedClientIp } from '@/lib/security/request';

/**
 * Journal d'audit administrateur.
 * Les instantanés `before`/`after` sont nettoyés des champs sensibles avant
 * persistance (aucun mot de passe ni secret n'est journalisé).
 */

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'secret',
  'token',
  'securetokenhash',
  'apikey',
  'authorization',
];

export function sanitizeForAudit(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object') return value as Prisma.InputJsonValue;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForAudit(item) ?? null) as Prisma.InputJsonValue;
  }

  const result: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      result[key] = '[masqué]';
      return;
    }
    if (item instanceof Date) {
      result[key] = item.toISOString();
      return;
    }
    result[key] = item === null || item === undefined ? null : (sanitizeForAudit(item) ?? null);
  });
  return result as Prisma.InputJsonValue;
}

export interface AuditInput {
  adminUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: input.adminUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: sanitizeForAudit(input.before),
        after: sanitizeForAudit(input.after),
        ipHash: await getHashedClientIp().catch(() => null),
      },
    });
  } catch (error) {
    // Un échec de journalisation ne doit jamais interrompre l'action métier.
    console.error('[audit] échec de journalisation', {
      action: input.action,
      entityType: input.entityType,
      message: error instanceof Error ? error.message : 'erreur inconnue',
    });
  }
}

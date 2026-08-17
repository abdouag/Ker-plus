import 'server-only';

import type { Prisma } from '@prisma/client';

/**
 * Construction des filtres d'administration.
 * Les pages et les exports partagent ces fonctions afin qu'un export
 * corresponde toujours exactement à ce qui est affiché à l'écran.
 */

export interface ListParams {
  q?: string;
  from?: string;
  to?: string;
  statut?: string;
  ville?: string;
  finition?: string;
  page?: string;
}

export const PAGE_SIZE = 25;

export function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  // Africa/Dakar est à UTC+00:00 : les bornes locales et UTC coïncident.
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function dateRangeFilter(params: ListParams): Prisma.DateTimeFilter | undefined {
  const gte = parseDate(params.from);
  const lte = parseDate(params.to, true);
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

export function simulationWhere(params: ListParams): Prisma.SimulationWhereInput {
  const createdAt = dateRangeFilter(params);
  const query = params.q?.trim();

  return {
    ...(createdAt ? { createdAt } : {}),
    ...(params.ville ? { cityZoneId: params.ville } : {}),
    ...(params.finition ? { finishLevelId: params.finition } : {}),
    ...(query
      ? {
          OR: [
            { reference: { contains: query, mode: 'insensitive' } },
            { customer: { email: { contains: query, mode: 'insensitive' } } },
            { customer: { phone: { contains: query } } },
            { customer: { lastName: { contains: query, mode: 'insensitive' } } },
            { customer: { firstName: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
}

export function customerWhere(params: ListParams): Prisma.CustomerWhereInput {
  const createdAt = dateRangeFilter(params);
  const query = params.q?.trim();

  return {
    ...(createdAt ? { createdAt } : {}),
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { whatsapp: { contains: query } },
          ],
        }
      : {}),
  };
}

const ORDER_STATUSES = [
  'DRAFT',
  'AWAITING_PAYMENT',
  'PAID',
  'IN_PREPARATION',
  'READY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;

export function orderWhere(params: ListParams): Prisma.OrderWhereInput {
  const createdAt = dateRangeFilter(params);
  const query = params.q?.trim();
  const status = ORDER_STATUSES.find((value) => value === params.statut);

  return {
    ...(createdAt ? { createdAt } : {}),
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { reference: { contains: query, mode: 'insensitive' } },
            { customer: { email: { contains: query, mode: 'insensitive' } } },
            { customer: { phone: { contains: query } } },
            { customer: { lastName: { contains: query, mode: 'insensitive' } } },
            { customer: { firstName: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
}

const PAYMENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;

export function paymentWhere(params: ListParams): Prisma.PaymentWhereInput {
  const createdAt = dateRangeFilter(params);
  const query = params.q?.trim();
  const status = PAYMENT_STATUSES.find((value) => value === params.statut);

  return {
    ...(createdAt ? { createdAt } : {}),
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { order: { reference: { contains: query, mode: 'insensitive' } } },
            { externalReference: { contains: query, mode: 'insensitive' } },
            { providerTransactionId: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

/** Construit une querystring en conservant uniquement les filtres actifs. */
export function buildQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}

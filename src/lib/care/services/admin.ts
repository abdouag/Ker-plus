import 'server-only';

import type { Prisma, RequestKind, RequestStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { daysAgo } from '@/lib/dates';
import { CareError } from '../errors';

/** Filtres de la liste des demandes en administration. */
/** Regroupements de statuts proposés en filtre (cartes « À traiter »). */
export const STATUS_GROUPS = {
  'a-affecter': { label: 'À affecter', statuses: ['SUBMITTED', 'SEARCHING'] },
  'a-cloturer': { label: 'À clôturer ou contestées', statuses: ['VALIDATED', 'DISPUTED'] },
} as const satisfies Record<string, { label: string; statuses: RequestStatus[] }>;

export type StatusGroup = keyof typeof STATUS_GROUPS;

export interface RequestFilters {
  status?: RequestStatus;
  group?: StatusGroup;
  kind?: RequestKind;
  categoryId?: string;
  commune?: string;
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
}

export const ADMIN_PAGE_SIZE = 25;

export async function listRequestsForAdmin(filters: RequestFilters) {
  const where: Prisma.ServiceRequestWhereInput = {
    ...(filters.status
      ? { status: filters.status }
      : filters.group
        ? { status: { in: [...STATUS_GROUPS[filters.group].statuses] } }
        : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.commune
      ? { property: { commune: { contains: filters.commune, mode: 'insensitive' } } }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { reference: { contains: filters.q, mode: 'insensitive' } },
            { requester: { name: { contains: filters.q, mode: 'insensitive' } } },
            { requester: { phone: { contains: filters.q } } },
          ],
        }
      : {}),
  };
  const page = Math.max(1, filters.page ?? 1);
  const [items, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        property: { select: { commune: true, quartier: true } },
        requester: { select: { name: true, phone: true } },
        assignments: {
          where: { status: { in: ['PENDING', 'ACCEPTED'] } },
          include: { provider: { include: { account: { select: { name: true } } } } },
        },
      },
    }),
    prisma.serviceRequest.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function getRequestForAdmin(id: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      category: true,
      equipment: { include: { type: true } },
      property: true,
      requester: { select: { id: true, name: true, email: true, phone: true } },
      attachments: { orderBy: { createdAt: 'asc' } },
      assignments: {
        orderBy: { assignedAt: 'desc' },
        include: {
          provider: { include: { account: { select: { name: true, phone: true } } } },
          assignedBy: { select: { name: true } },
        },
      },
      quotes: {
        orderBy: { version: 'desc' },
        include: { lines: { orderBy: { position: 'asc' } } },
      },
      appointments: { orderBy: { startsAt: 'asc' } },
      reports: { orderBy: { revision: 'desc' }, include: { attachments: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        include: {
          actorAccount: { select: { name: true } },
          actorAdmin: { select: { name: true } },
        },
      },
      review: true,
    },
  });
  if (!request) throw new CareError('Demande introuvable.', 404);
  return request;
}

/**
 * Prestataires éligibles pour une demande : vérifiés, actifs, triés par
 * pertinence (spécialité, zone) puis par charge en cours.
 */
export async function eligibleProviders(categorySlug: string, commune: string) {
  const providers = await prisma.providerProfile.findMany({
    where: { verificationStatus: 'VERIFIED', account: { active: true } },
    include: {
      account: { select: { name: true, phone: true } },
      _count: {
        select: {
          assignments: {
            where: {
              status: { in: ['PENDING', 'ACCEPTED'] },
              request: { status: { notIn: ['CLOSED', 'CANCELLED', 'VALIDATED'] } },
            },
          },
        },
      },
    },
  });
  const normalizedCommune = commune.trim().toLowerCase();
  return providers
    .map((provider) => ({
      ...provider,
      matchesSpecialty: categorySlug === 'autre' || provider.specialties.includes(categorySlug),
      matchesZone:
        provider.zones.length === 0 ||
        provider.zones.some((zone) => zone.trim().toLowerCase() === normalizedCommune),
      activeMissions: provider._count.assignments,
    }))
    .sort(
      (a, b) =>
        Number(b.matchesSpecialty) - Number(a.matchesSpecialty) ||
        Number(b.matchesZone) - Number(a.matchesZone) ||
        a.activeMissions - b.activeMissions,
    );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export interface CareIndicators {
  periodDays: number;
  received: number;
  medianFirstResponseMinutes: number | null;
  assignmentRate: number | null;
  quoteAcceptanceRate: number | null;
  closureRate: number | null;
  cancellations: number;
  disputes: number;
  averageRating: number | null;
  reviewCount: number;
  toAssign: number;
  toClose: number;
  pendingVerification: number;
  acceptedQuotesTotal: number;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Indicateurs calculés uniquement à partir des données réelles. */
export async function computeIndicators(periodDays = 30): Promise<CareIndicators> {
  const since = daysAgo(periodDays);
  const requests = await prisma.serviceRequest.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      firstResponseAt: true,
      assignments: { select: { id: true }, take: 1 },
    },
  });
  const ids = requests.map((request) => request.id);

  const [quotes, reviews, toAssign, toClose, pendingVerification] = await Promise.all([
    prisma.quote.findMany({
      where: { requestId: { in: ids }, status: { in: ['ACCEPTED', 'REFUSED'] } },
      select: { status: true, totalAmount: true },
    }),
    prisma.review.findMany({ where: { requestId: { in: ids } }, select: { rating: true } }),
    prisma.serviceRequest.count({ where: { status: { in: ['SUBMITTED', 'SEARCHING'] } } }),
    prisma.serviceRequest.count({ where: { status: { in: ['VALIDATED', 'DISPUTED'] } } }),
    prisma.providerProfile.count({ where: { verificationStatus: 'PENDING' } }),
  ]);

  const responseMinutes = requests
    .filter((request) => request.firstResponseAt)
    .map((request) =>
      Math.round((request.firstResponseAt!.getTime() - request.createdAt.getTime()) / 60_000),
    );

  const decidedQuotes = quotes.length;
  const acceptedQuotes = quotes.filter((quote) => quote.status === 'ACCEPTED');
  const cancellations = requests.filter((request) => request.status === 'CANCELLED').length;
  const nonCancelled = requests.length - cancellations;

  return {
    periodDays,
    received: requests.length,
    medianFirstResponseMinutes: median(responseMinutes),
    assignmentRate: rate(requests.filter((r) => r.assignments.length > 0).length, requests.length),
    quoteAcceptanceRate: rate(acceptedQuotes.length, decidedQuotes),
    closureRate: rate(
      requests.filter((r) => r.status === 'CLOSED' || r.status === 'VALIDATED').length,
      nonCancelled,
    ),
    cancellations,
    disputes: requests.filter((request) => request.status === 'DISPUTED').length,
    averageRating: reviews.length
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10,
        ) / 10
      : null,
    reviewCount: reviews.length,
    toAssign,
    toClose,
    pendingVerification,
    acceptedQuotesTotal: acceptedQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0),
  };
}

import 'server-only';

import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { CareError } from '../errors';
import type { providerSchema, providerSelfSchema, signupSchema } from '../validation';

/** Création d'un compte client (inscription publique). */
export async function createClientAccount(input: z.infer<typeof signupSchema>) {
  try {
    return await prisma.account.create({
      data: {
        role: 'CLIENT',
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        consentAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CareError('Un compte existe déjà avec cette adresse email. Connectez-vous.', 409);
    }
    throw error;
  }
}

/** Création d'un prestataire par l'administration (vérification en attente). */
export async function createProviderAccount(
  input: z.infer<typeof providerSchema>,
  temporaryPassword: string,
) {
  try {
    return await prisma.account.create({
      data: {
        role: 'PROVIDER',
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(temporaryPassword),
        providerProfile: {
          create: {
            businessName: input.businessName ?? null,
            specialties: input.specialties,
            zones: input.zones,
            workingHours: input.workingHours ?? null,
            indicativeRates: input.indicativeRates ?? null,
            bio: input.bio ?? null,
          },
        },
      },
      include: { providerProfile: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CareError('Un compte existe déjà avec cette adresse email.', 409);
    }
    throw error;
  }
}

export async function updateProviderByAdmin(
  providerId: string,
  input: z.infer<typeof providerSchema>,
) {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new CareError('Prestataire introuvable.', 404);
  try {
    await prisma.account.update({
      where: { id: profile.accountId },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        providerProfile: {
          update: {
            businessName: input.businessName ?? null,
            specialties: input.specialties,
            zones: input.zones,
            workingHours: input.workingHours ?? null,
            indicativeRates: input.indicativeRates ?? null,
            bio: input.bio ?? null,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new CareError('Cette adresse email est déjà utilisée.', 409);
    }
    throw error;
  }
}

/** Le prestataire met à jour son profil (sans toucher spécialités ni vérification). */
export async function updateOwnProviderProfile(
  providerId: string,
  input: z.infer<typeof providerSelfSchema>,
) {
  await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      businessName: input.businessName ?? null,
      workingHours: input.workingHours ?? null,
      indicativeRates: input.indicativeRates ?? null,
      bio: input.bio ?? null,
      zones: input.zones,
    },
  });
}

export async function listProviders() {
  return prisma.providerProfile.findMany({
    orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
    include: {
      account: { select: { id: true, name: true, email: true, phone: true, active: true, lastLoginAt: true } },
      _count: { select: { assignments: true } },
    },
  });
}

/** Note moyenne et nombre d'avis par prestataire (interventions acceptées). */
export async function providerRatings(): Promise<Map<string, { average: number; count: number }>> {
  const reviews = await prisma.review.findMany({
    select: {
      rating: true,
      request: { select: { assignments: { where: { status: 'ACCEPTED' }, select: { providerId: true } } } },
    },
  });
  const totals = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    for (const assignment of review.request.assignments) {
      const current = totals.get(assignment.providerId) ?? { sum: 0, count: 0 };
      current.sum += review.rating;
      current.count += 1;
      totals.set(assignment.providerId, current);
    }
  }
  return new Map(
    [...totals].map(([id, { sum, count }]) => [id, { average: Math.round((sum / count) * 10) / 10, count }]),
  );
}

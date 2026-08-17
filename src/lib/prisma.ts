import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma unique. En développement, Next.js recharge les modules à
 * chaque édition : on mémorise le client sur `globalThis` pour éviter
 * l'épuisement du pool de connexions.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

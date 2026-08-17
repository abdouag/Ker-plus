import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Sonde de santé utilisée par Docker et l'infrastructure de déploiement. */
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', database: 'ok', timestamp: new Date().toISOString() },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'unreachable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}

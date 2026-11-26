import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth/guard';
import { getCurrentAccount } from '@/lib/auth/account-guard';
import { readStoredFile } from '@/lib/care/storage';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Accès aux fichiers privés Kër Care.
 *
 *  - administrateur connecté : tous les fichiers ;
 *  - client : fichiers de ses logements et de ses demandes ;
 *  - prestataire : uniquement les photos et rapports des missions qui lui
 *    sont actuellement affectées — jamais les documents du carnet (plans,
 *    factures, garanties).
 *
 * Réponse identique (404) quel que soit le motif du refus.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ip = await getClientIp();
  if (!consumeRateLimit(`care-file:${ip}`, RATE_LIMITS.careFile).allowed) {
    return new NextResponse('Trop de requêtes.', { status: 429 });
  }

  const { id } = await params;
  const notFound = new NextResponse('Fichier introuvable.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return notFound;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      property: { select: { ownerId: true } },
      request: {
        select: {
          requesterId: true,
          assignments: {
            where: { status: { in: ['PENDING', 'ACCEPTED'] } },
            select: { providerId: true },
          },
        },
      },
    },
  });
  if (!attachment || attachment.archivedAt) return notFound;

  let allowed = false;
  const admin = await getCurrentAdmin();
  if (admin) {
    allowed = true;
  } else {
    const account = await getCurrentAccount();
    if (account?.role === 'CLIENT') {
      allowed =
        attachment.property?.ownerId === account.id ||
        attachment.request?.requesterId === account.id;
    } else if (account?.role === 'PROVIDER' && account.providerProfile) {
      const providerId = account.providerProfile.id;
      allowed =
        !attachment.propertyId &&
        Boolean(attachment.request?.assignments.some((item) => item.providerId === providerId));
    }
  }
  if (!allowed) return notFound;

  const content = await readStoredFile(attachment.fileKey);
  if (!content) return notFound;

  const inline = attachment.mimeType.startsWith('image/') || attachment.mimeType === 'application/pdf';
  const safeName = attachment.fileName.replace(/[^\p{L}\p{N}._ -]/gu, '_');
  return new NextResponse(new Uint8Array(content), {
    status: 200,
    headers: {
      'content-type': attachment.mimeType,
      'content-length': String(content.byteLength),
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'cache-control': 'private, no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

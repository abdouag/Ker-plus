import { NextResponse } from 'next/server';
import { resolveDownload } from '@/lib/services/reports';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Téléchargement sécurisé d'un rapport.
 *
 * Le jeton est aléatoire (32 octets), stocké haché, expirable et révocable.
 * Les fichiers ne sont jamais placés dans `public/` : ils ne sont accessibles
 * que par cette route. Aucune information n'est divulguée en cas d'échec.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const ip = await getClientIp();
  const limit = consumeRateLimit(`download:${ip}`, RATE_LIMITS.download);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Trop de tentatives. Réessayez plus tard.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  const { token } = await params;
  const download = await resolveDownload(token);

  if (!download) {
    return new NextResponse(
      'Lien de téléchargement invalide, expiré ou révoqué. Contactez Kerplus pour en obtenir un nouveau.',
      { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  return new NextResponse(new Uint8Array(download.content), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${download.fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'content-length': String(download.content.byteLength),
      'cache-control': 'private, no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

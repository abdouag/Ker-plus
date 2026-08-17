import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth/guard';
import { readReportFile } from '@/lib/services/reports';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Prévisualisation du PDF par un administrateur authentifié.
 * Le fichier est servi en flux, jamais exposé publiquement.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ message: 'Authentification requise.' }, { status: 401 });
  }

  const { orderId } = await params;
  const file = await readReportFile(orderId);
  if (!file) {
    return NextResponse.json({ message: 'Aucun PDF disponible.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.content), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${file.fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'cache-control': 'private, no-store, max-age=0',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

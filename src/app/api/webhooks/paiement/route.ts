import { NextResponse } from 'next/server';
import { processPaymentWebhook } from '@/lib/services/payments';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { getClientIp } from '@/lib/security/request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Point d'entrée des notifications de paiement.
 *
 * Le corps brut est lu tel quel : toute altération invaliderait la signature.
 * Une notification non signée ou déjà traitée ne modifie jamais une commande.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = await getClientIp();
  const limit = consumeRateLimit(`webhook:${ip}`, RATE_LIMITS.webhook);
  if (!limit.allowed) {
    return NextResponse.json(
      { received: false, message: 'Trop de notifications.' },
      { status: 429 },
    );
  }

  const rawBody = await request.text();
  if (!rawBody) {
    return NextResponse.json({ received: false, message: 'Corps vide.' }, { status: 400 });
  }

  try {
    const outcome = await processPaymentWebhook(rawBody, request.headers);
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    console.error('[webhook] traitement impossible', {
      message: error instanceof Error ? error.message : 'erreur inconnue',
    });
    return NextResponse.json(
      { received: false, message: 'Traitement impossible.' },
      { status: 500 },
    );
  }
}

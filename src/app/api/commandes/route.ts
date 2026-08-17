import { NextResponse } from 'next/server';
import { createOrderSchema } from '@/lib/validation/schemas';
import { createOrder, OrderError } from '@/lib/services/orders';
import { EstimationReferentialError } from '@/lib/services/estimation';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { getClientIp, getUserAgent, hashIp } from '@/lib/security/request';
import { verifyCaptcha } from '@/lib/security/captcha';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Création d'une commande de rapport Premium.
 *
 * Le montant n'est jamais lu depuis la requête : il provient du paramètre
 * administrable. Le paiement est créé au statut PENDING et ne peut en aucun
 * cas être confirmé depuis le navigateur.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = await getClientIp();
  const limit = consumeRateLimit(`order:${ip}`, RATE_LIMITS.order);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Trop de demandes envoyées. Réessayez dans quelques minutes ou contactez Kerplus.',
      },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Requête invalide.' }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const key = String(issue.path[0] ?? 'global');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    });
    return NextResponse.json(
      { ok: false, message: 'Certaines informations doivent être corrigées.', fieldErrors },
      { status: 400 },
    );
  }

  // Champ leurre rempli : requête automatisée. Réponse neutre, aucun traitement.
  if (parsed.data.website) {
    return NextResponse.json({ ok: false, message: 'Requête rejetée.' }, { status: 400 });
  }

  const captcha = await verifyCaptcha(parsed.data.captchaToken, ip);
  if (!captcha.ok) {
    return NextResponse.json(
      { ok: false, message: captcha.reason ?? 'Vérification anti-robot échouée.' },
      { status: 400 },
    );
  }

  try {
    const result = await createOrder(parsed.data, {
      ipHash: hashIp(ip),
      userAgent: await getUserAgent(),
    });

    return NextResponse.json(
      {
        ok: true,
        orderReference: result.order.reference,
        simulationReference: result.simulationReference,
        amount: result.order.amount,
        currency: result.order.currency,
        status: result.order.status,
        paymentStatus: result.payment.status,
        redirectUrl: result.redirectUrl ?? null,
        requiresManualConfirmation: result.requiresManualConfirmation,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OrderError || error instanceof EstimationReferentialError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[api/commandes] création impossible', {
      message: error instanceof Error ? error.message : 'erreur inconnue',
    });
    return NextResponse.json(
      {
        ok: false,
        message: 'La commande n’a pas pu être enregistrée. Réessayez ou contactez Kerplus.',
      },
      { status: 500 },
    );
  }
}

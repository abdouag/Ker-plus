import { NextResponse } from 'next/server';
import { z } from 'zod';
import { estimationInputSchema } from '@/lib/validation/schemas';
import {
  computeServerEstimation,
  persistSimulation,
  EstimationReferentialError,
} from '@/lib/services/estimation';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { getClientIp, getUserAgent, hashIp } from '@/lib/security/request';
import { getSettingBool, SETTING_KEYS } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const requestSchema = estimationInputSchema.extend({
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
});

/**
 * Recalcul et enregistrement d'une simulation.
 * Les montants renvoyés sont ceux calculés par le serveur : aucune valeur
 * transmise par le navigateur n'est acceptée ni renvoyée telle quelle.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = await getClientIp();
  const limit = consumeRateLimit(`estimate:${ip}`, RATE_LIMITS.estimate);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Trop de requêtes. Réessayez dans un instant.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  if (!(await getSettingBool(SETTING_KEYS.ESTIMATOR_ENABLED, true))) {
    return NextResponse.json(
      { ok: false, message: 'L’estimateur est temporairement indisponible.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Requête invalide.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Paramètres d’estimation invalides.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const snapshot = await computeServerEstimation(parsed.data);
    const simulation = await persistSimulation(snapshot, {
      ipHash: hashIp(ip),
      userAgent: await getUserAgent(),
      utmSource: parsed.data.utmSource,
      utmMedium: parsed.data.utmMedium,
      utmCampaign: parsed.data.utmCampaign,
    });

    return NextResponse.json({
      ok: true,
      reference: simulation.reference,
      estimatedTotal: snapshot.estimatedTotal,
      estimatedMinimum: snapshot.estimatedMinimum,
      estimatedMaximum: snapshot.estimatedMaximum,
      rangePercentage: snapshot.rangePercentageSnapshot,
      createdAt: simulation.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof EstimationReferentialError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[api/estimation] échec du calcul', {
      message: error instanceof Error ? error.message : 'erreur inconnue',
    });
    return NextResponse.json(
      { ok: false, message: 'Le calcul a échoué. Réessayez.' },
      { status: 500 },
    );
  }
}

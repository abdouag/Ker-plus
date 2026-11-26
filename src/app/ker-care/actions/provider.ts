'use server';

import { revalidatePath } from 'next/cache';
import { requireProvider } from '@/lib/auth/account-guard';
import { assertCsrf } from '@/lib/security/csrf';
import { RATE_LIMITS } from '@/lib/security/rate-limit';
import { CareError } from '@/lib/care/errors';
import { readFiles } from '@/lib/care/storage';
import {
  appointmentSchema,
  firstIssue,
  providerSelfSchema,
  quoteSchema,
  reportSchema,
  splitList,
} from '@/lib/care/validation';
import * as requests from '@/lib/care/services/requests';
import { updateOwnProviderProfile } from '@/lib/care/services/accounts';
import { assertRateLimit, fields, text, toCareActionState, type CareActionState } from './shared';

const SPACE = '/ker-care/prestataire';

async function guard(formData: FormData) {
  await assertCsrf(formData);
  await assertRateLimit('care-write', RATE_LIMITS.careWrite);
  const { account, providerId } = await requireProvider();
  return { accountId: account.id, providerId };
}

export async function respondMissionAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const provider = await guard(formData);
    const accept = text(formData, 'decision') === 'accept';
    await requests.respondToAssignment(
      provider,
      text(formData, 'reference', 40),
      accept,
      text(formData, 'reason', 500) || undefined,
    );
    revalidatePath(SPACE, 'layout');
    return {
      ok: true,
      message: accept ? 'Mission acceptée. Les coordonnées du client sont visibles.' : 'Mission refusée.',
    };
  } catch (error) {
    return toCareActionState(error, 'réponse mission');
  }
}

/**
 * Lignes de devis transmises sous forme de champs parallèles
 * (lineLabel / lineQuantity / lineUnitPrice). Les lignes vides sont ignorées.
 */
function readQuoteLines(formData: FormData) {
  const labels = formData.getAll('lineLabel').map((value) => String(value).trim());
  const quantities = formData.getAll('lineQuantity').map(String);
  const prices = formData.getAll('lineUnitPrice').map(String);
  return labels
    .map((label, index) => ({
      label,
      quantity: quantities[index]?.replace(/\D/g, '') || '1',
      unitPrice: prices[index]?.replace(/\D/g, '') || '0',
    }))
    .filter((line) => line.label !== '');
}

function amount(formData: FormData, name: string): string {
  return text(formData, name, 20).replace(/\D/g, '') || '0';
}

export async function createQuoteAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const provider = await guard(formData);
    const parsed = quoteSchema.safeParse({
      lines: readQuoteLines(formData),
      travelFee: amount(formData, 'travelFee'),
      diagnosticFee: amount(formData, 'diagnosticFee'),
      laborAmount: amount(formData, 'laborAmount'),
      otherFees: amount(formData, 'otherFees'),
      discountAmount: amount(formData, 'discountAmount'),
      taxAmount: amount(formData, 'taxAmount'),
      ...fields(formData, ['validityDays', 'conditions', 'exclusions', 'note']),
    });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const quote = await requests.createQuote(provider, text(formData, 'reference', 40), parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: `Devis v${quote.version} envoyé au client.` };
  } catch (error) {
    return toCareActionState(error, 'création devis');
  }
}

export async function proposeAppointmentAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const provider = await guard(formData);
    const parsed = appointmentSchema.safeParse({
      ...fields(formData, ['type', 'date', 'startTime', 'durationMinutes', 'note']),
      fee: amount(formData, 'fee'),
    });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await requests.proposeAppointment(provider, text(formData, 'reference', 40), parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Créneau proposé au client.' };
  } catch (error) {
    return toCareActionState(error, 'proposition rendez-vous');
  }
}

export async function missionProgressAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const provider = await guard(formData);
    const operation = text(formData, 'operation', 30);
    const reference = text(formData, 'reference', 40);
    let message: string;
    switch (operation) {
      case 'EN_ROUTE':
      case 'ARRIVED':
      case 'IN_PROGRESS':
        await requests.advanceOnSite(provider, reference, operation);
        message = 'Statut mis à jour.';
        break;
      case 'diagnostic-done':
        await requests.markDiagnosticDone(provider, text(formData, 'appointmentId', 40));
        message = 'Visite de diagnostic marquée comme effectuée.';
        break;
      case 'cancel-appointment':
        await requests.cancelAppointment(
          { type: 'PROVIDER', ...provider },
          text(formData, 'appointmentId', 40),
          text(formData, 'reason', 500),
        );
        message = 'Rendez-vous annulé.';
        break;
      default:
        throw new CareError('Action inconnue.');
    }
    revalidatePath(SPACE, 'layout');
    return { ok: true, message };
  } catch (error) {
    return toCareActionState(error, 'progression mission');
  }
}

export async function submitReportAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const provider = await guard(formData);
    const parsed = reportSchema.safeParse(
      fields(formData, [
        'diagnostic',
        'workDone',
        'partsUsed',
        'recommendations',
        'durationMinutes',
        'nextMaintenanceAt',
      ]),
    );
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await requests.submitReport(provider, text(formData, 'reference', 40), parsed.data, {
      before: readFiles(formData, 'photosBefore'),
      after: readFiles(formData, 'photosAfter'),
    });
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Rapport déposé. Le client va valider l’intervention.' };
  } catch (error) {
    return toCareActionState(error, 'dépôt rapport');
  }
}

export async function updateProviderProfileAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const provider = await guard(formData);
    const parsed = providerSelfSchema.safeParse({
      ...fields(formData, ['businessName', 'workingHours', 'indicativeRates', 'bio']),
      zones: splitList(text(formData, 'zones', 2000)),
    });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await updateOwnProviderProfile(provider.providerId, parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Profil mis à jour.' };
  } catch (error) {
    return toCareActionState(error, 'profil prestataire');
  }
}

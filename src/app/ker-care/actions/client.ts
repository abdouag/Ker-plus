'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AttachmentKind } from '@prisma/client';
import { requireClient } from '@/lib/auth/account-guard';
import { assertCsrf } from '@/lib/security/csrf';
import { RATE_LIMITS } from '@/lib/security/rate-limit';
import { CareError } from '@/lib/care/errors';
import { PROPERTY_DOCUMENT_KINDS } from '@/lib/care/constants';
import { readFiles } from '@/lib/care/storage';
import {
  equipmentSchema,
  firstIssue,
  propertySchema,
  requestSchema,
  reviewSchema,
  taskSchema,
} from '@/lib/care/validation';
import * as properties from '@/lib/care/services/properties';
import * as requests from '@/lib/care/services/requests';
import { assertRateLimit, fields, text, toCareActionState, type CareActionState } from './shared';

const SPACE = '/ker-care/mon-espace';

const PROPERTY_FIELDS = [
  'name',
  'type',
  'commune',
  'quartier',
  'landmark',
  'address',
  'surface',
  'levels',
  'bedrooms',
  'bathrooms',
  'yearBuilt',
];

const EQUIPMENT_FIELDS = [
  'typeId',
  'name',
  'location',
  'quantity',
  'brand',
  'model',
  'installedAt',
  'warrantyUntil',
  'lastServiceAt',
  'frequencyMonths',
  'notes',
];

async function guard(formData: FormData) {
  await assertCsrf(formData);
  await assertRateLimit('care-write', RATE_LIMITS.careWrite);
  return requireClient();
}

// ---------------------------------------------------------------------------
// Logements
// ---------------------------------------------------------------------------

export async function createPropertyAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  let target: string;
  try {
    const account = await guard(formData);
    const parsed = propertySchema.safeParse(fields(formData, PROPERTY_FIELDS));
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const property = await properties.createProperty(account.id, parsed.data);
    // Depuis le formulaire de demande : retour au formulaire, logement présélectionné.
    const returnTo = text(formData, 'returnTo', 200);
    target =
      returnTo === 'demande'
        ? `${SPACE}/demandes/nouvelle?logement=${property.id}`
        : `${SPACE}/maisons/${property.id}`;
  } catch (error) {
    return toCareActionState(error, 'création logement');
  }
  revalidatePath(SPACE, 'layout');
  redirect(target);
}

export async function updatePropertyAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const propertyId = text(formData, 'propertyId', 40);
    const parsed = propertySchema.safeParse(fields(formData, PROPERTY_FIELDS));
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await properties.updateProperty(account.id, propertyId, parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Logement mis à jour.' };
  } catch (error) {
    return toCareActionState(error, 'mise à jour logement');
  }
}

export async function archivePropertyAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const archived = text(formData, 'archived') === 'true';
    await properties.setPropertyArchived(account.id, text(formData, 'propertyId', 40), archived);
    revalidatePath(SPACE, 'layout');
    return {
      ok: true,
      message: archived
        ? 'Logement archivé. Son historique reste consultable.'
        : 'Logement réactivé.',
    };
  } catch (error) {
    return toCareActionState(error, 'archivage logement');
  }
}

export async function linkOrderAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    await properties.linkOrderToProperty(
      account,
      text(formData, 'propertyId', 40),
      text(formData, 'orderReference', 40),
    );
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Projet Kerplus rattaché au carnet du logement.' };
  } catch (error) {
    return toCareActionState(error, 'rattachement commande');
  }
}

// ---------------------------------------------------------------------------
// Équipements
// ---------------------------------------------------------------------------

export async function createEquipmentAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const parsed = equipmentSchema.safeParse(fields(formData, EQUIPMENT_FIELDS));
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await properties.createEquipment(account.id, text(formData, 'propertyId', 40), parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Équipement ajouté au carnet.' };
  } catch (error) {
    return toCareActionState(error, 'création équipement');
  }
}

export async function updateEquipmentAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const parsed = equipmentSchema.safeParse(fields(formData, EQUIPMENT_FIELDS));
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await properties.updateEquipment(account.id, text(formData, 'equipmentId', 40), parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Équipement mis à jour.' };
  } catch (error) {
    return toCareActionState(error, 'mise à jour équipement');
  }
}

export async function archiveEquipmentAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const archived = text(formData, 'archived') === 'true';
    await properties.setEquipmentArchived(account.id, text(formData, 'equipmentId', 40), archived);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: archived ? 'Équipement archivé.' : 'Équipement réactivé.' };
  } catch (error) {
    return toCareActionState(error, 'archivage équipement');
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function uploadDocumentsAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const kind = text(formData, 'kind', 20) as AttachmentKind;
    if (!PROPERTY_DOCUMENT_KINDS.includes(kind)) throw new CareError('Type de document invalide.');
    const count = await properties.addPropertyDocuments(
      account.id,
      text(formData, 'propertyId', 40),
      readFiles(formData, 'files'),
      {
        kind,
        title: text(formData, 'title', 120) || undefined,
        equipmentId: text(formData, 'equipmentId', 40) || undefined,
      },
    );
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: `${count} document(s) ajouté(s) au carnet.` };
  } catch (error) {
    return toCareActionState(error, 'ajout document');
  }
}

export async function archiveDocumentAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    await properties.archivePropertyDocument(account.id, text(formData, 'attachmentId', 40));
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Document retiré du carnet.' };
  } catch (error) {
    return toCareActionState(error, 'archivage document');
  }
}

// ---------------------------------------------------------------------------
// Entretiens
// ---------------------------------------------------------------------------

export async function createTaskAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const parsed = taskSchema.safeParse(
      fields(formData, ['title', 'equipmentId', 'dueAt', 'frequencyMonths', 'recommendation']),
    );
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await properties.createTask(account.id, text(formData, 'propertyId', 40), parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Entretien ajouté.' };
  } catch (error) {
    return toCareActionState(error, 'création entretien');
  }
}

function readDate(formData: FormData, name: string): Date {
  const value = text(formData, name, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CareError('Date invalide.');
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new CareError('Date invalide.');
  return date;
}

export async function taskAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const taskId = text(formData, 'taskId', 40);
    const operation = text(formData, 'operation', 20);
    let message: string;
    if (operation === 'postpone') {
      await properties.postponeTask(account.id, taskId, readDate(formData, 'dueAt'));
      message = 'Échéance reportée.';
    } else if (operation === 'complete') {
      await properties.completeTask(account.id, taskId);
      message = 'Entretien marqué comme effectué.';
    } else if (operation === 'cancel') {
      await properties.cancelTask(account.id, taskId);
      message = 'Entretien annulé.';
    } else {
      throw new CareError('Action inconnue.');
    }
    revalidatePath(SPACE, 'layout');
    return { ok: true, message };
  } catch (error) {
    return toCareActionState(error, 'action entretien');
  }
}

// ---------------------------------------------------------------------------
// Demandes d'intervention
// ---------------------------------------------------------------------------

export async function createRequestAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  let reference: string;
  try {
    await assertCsrf(formData);
    const account = await requireClient();
    await assertRateLimit('care-request', RATE_LIMITS.careRequest);
    const parsed = requestSchema.safeParse({
      ...fields(formData, [
        'idempotencyKey',
        'propertyId',
        'categoryId',
        'equipmentId',
        'maintenanceTaskId',
        'description',
        'kind',
        'preferredDate',
        'preferredSlot',
      ]),
      safetyAcknowledged: formData.get('safetyAcknowledged') === 'on',
    });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const result = await requests.createServiceRequest(
      account.id,
      parsed.data,
      readFiles(formData, 'photos'),
    );
    reference = result.reference;
  } catch (error) {
    return toCareActionState(error, 'création demande');
  }
  revalidatePath(SPACE, 'layout');
  redirect(`${SPACE}/demandes/${reference}?envoyee=1`);
}

/** Actions du client sur une demande : devis, rendez-vous, validation, annulation. */
export async function requestDecisionAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const reference = text(formData, 'reference', 40);
    const operation = text(formData, 'operation', 30);
    const reason = text(formData, 'reason', 1000);
    let message: string;

    switch (operation) {
      case 'accept-quote':
        await requests.acceptQuote(account.id, text(formData, 'quoteId', 40));
        message = 'Devis accepté. Le prestataire va vous proposer un créneau.';
        break;
      case 'refuse-quote':
        await requests.refuseQuote(account.id, text(formData, 'quoteId', 40), reason);
        message = 'Devis refusé.';
        break;
      case 'confirm-appointment':
        await requests.confirmAppointment(account.id, text(formData, 'appointmentId', 40));
        message = 'Rendez-vous confirmé.';
        break;
      case 'cancel-appointment':
        await requests.cancelAppointment(
          { type: 'CLIENT', accountId: account.id },
          text(formData, 'appointmentId', 40),
          reason,
        );
        message = 'Rendez-vous annulé. Un nouveau créneau pourra vous être proposé.';
        break;
      case 'validate':
        await requests.validateIntervention(account.id, reference, reason);
        message = 'Intervention validée. Le carnet de votre logement a été mis à jour.';
        break;
      case 'contest':
        await requests.contestIntervention(account.id, reference, reason);
        message = 'Contestation transmise à Kerplus.';
        break;
      case 'cancel':
        await requests.cancelRequestByClient(account.id, reference, reason);
        message = 'Demande annulée.';
        break;
      default:
        throw new CareError('Action inconnue.');
    }
    revalidatePath(SPACE, 'layout');
    return { ok: true, message };
  } catch (error) {
    return toCareActionState(error, 'décision client');
  }
}

export async function reviewAction(
  _state: CareActionState,
  formData: FormData,
): Promise<CareActionState> {
  try {
    const account = await guard(formData);
    const parsed = reviewSchema.safeParse(
      fields(formData, ['rating', 'quality', 'punctuality', 'price', 'behaviour', 'comment']),
    );
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await requests.submitReview(account.id, text(formData, 'reference', 40), parsed.data);
    revalidatePath(SPACE, 'layout');
    return { ok: true, message: 'Merci pour votre avis !' };
  } catch (error) {
    return toCareActionState(error, 'avis');
  }
}

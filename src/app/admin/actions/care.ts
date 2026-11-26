'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { RequestStatus, VerificationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/guard';
import { hashPassword } from '@/lib/auth/password';
import { assertCsrf } from '@/lib/security/csrf';
import { recordAudit } from '@/lib/audit';
import { CareError } from '@/lib/care/errors';
import { firstIssue, providerSchema, splitLines, splitList } from '@/lib/care/validation';
import * as requests from '@/lib/care/services/requests';
import { createProviderAccount, updateProviderByAdmin } from '@/lib/care/services/accounts';
import { readBool, readInt, readText, toActionState, type ActionState } from './shared';

const ADMIN_CARE = '/admin/ker-care';

function revalidateCare() {
  revalidatePath(ADMIN_CARE, 'layout');
  revalidatePath('/ker-care', 'layout');
}

// ---------------------------------------------------------------------------
// Demandes
// ---------------------------------------------------------------------------

export async function assignProviderAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const requestId = readText(formData, 'requestId', 40);
    const providerId = readText(formData, 'providerId', 40);
    if (!providerId) throw new CareError('Choisissez un prestataire.');
    await requests.assignProvider(admin.id, requestId, providerId);
    await recordAudit({
      adminUserId: admin.id,
      action: 'care.request.assign',
      entityType: 'ServiceRequest',
      entityId: requestId,
      after: { providerId },
    });
    revalidateCare();
    return { ok: true, message: 'Prestataire affecté. Il doit accepter la mission.' };
  } catch (error) {
    return toActionState(error, 'affectation prestataire');
  }
}

export async function requestTransitionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const requestId = readText(formData, 'requestId', 40);
    const to = readText(formData, 'to', 30) as RequestStatus;
    const reason = readText(formData, 'reason', 1000);
    if ((to === 'CANCELLED' || to === 'SEARCHING') && !reason) {
      throw new CareError('Indiquez un motif.');
    }
    await requests.adminTransition(admin.id, requestId, to, reason);
    await recordAudit({
      adminUserId: admin.id,
      action: 'care.request.transition',
      entityType: 'ServiceRequest',
      entityId: requestId,
      after: { to, reason },
    });
    revalidateCare();
    return { ok: true, message: 'Statut mis à jour.' };
  } catch (error) {
    return toActionState(error, 'transition demande');
  }
}

export async function adminCancelAppointmentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const appointmentId = readText(formData, 'appointmentId', 40);
    await requests.cancelAppointment(
      { type: 'ADMIN', adminId: admin.id },
      appointmentId,
      readText(formData, 'reason', 500),
    );
    await recordAudit({
      adminUserId: admin.id,
      action: 'care.appointment.cancel',
      entityType: 'Appointment',
      entityId: appointmentId,
    });
    revalidateCare();
    return { ok: true, message: 'Rendez-vous annulé.' };
  } catch (error) {
    return toActionState(error, 'annulation rendez-vous');
  }
}

// ---------------------------------------------------------------------------
// Prestataires
// ---------------------------------------------------------------------------

function readProvider(formData: FormData) {
  return providerSchema.safeParse({
    name: readText(formData, 'name', 120),
    email: readText(formData, 'email', 160),
    phone: readText(formData, 'phone', 40),
    businessName: readText(formData, 'businessName', 120),
    specialties: formData.getAll('specialties').map(String),
    zones: splitList(readText(formData, 'zones', 2000)),
    workingHours: readText(formData, 'workingHours', 200),
    indicativeRates: readText(formData, 'indicativeRates', 500),
    bio: readText(formData, 'bio', 1000),
  });
}

/** Mot de passe temporaire lisible, à transmettre au prestataire hors ligne. */
function temporaryPassword(): string {
  return `Kp-${randomBytes(6).toString('base64url')}9`;
}

export async function createProviderAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const parsed = readProvider(formData);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    const password = temporaryPassword();
    const account = await createProviderAccount(parsed.data, password);
    await recordAudit({
      adminUserId: admin.id,
      action: 'care.provider.create',
      entityType: 'Account',
      entityId: account.id,
      after: { email: account.email, specialties: parsed.data.specialties },
    });
    revalidateCare();
    return {
      ok: true,
      message: `Prestataire créé (vérification en attente). Mot de passe temporaire à transmettre de façon sécurisée : ${password}`,
    };
  } catch (error) {
    return toActionState(error, 'création prestataire');
  }
}

export async function updateProviderAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const providerId = readText(formData, 'providerId', 40);
    const parsed = readProvider(formData);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
    await updateProviderByAdmin(providerId, parsed.data);
    await recordAudit({
      adminUserId: admin.id,
      action: 'care.provider.update',
      entityType: 'ProviderProfile',
      entityId: providerId,
      after: { specialties: parsed.data.specialties, zones: parsed.data.zones },
    });
    revalidateCare();
    return { ok: true, message: 'Prestataire mis à jour.' };
  } catch (error) {
    return toActionState(error, 'mise à jour prestataire');
  }
}

const VERIFICATION_VALUES: VerificationStatus[] = ['PENDING', 'VERIFIED', 'REFUSED', 'SUSPENDED'];

export async function setVerificationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');
    const providerId = readText(formData, 'providerId', 40);
    const status = readText(formData, 'status', 20) as VerificationStatus;
    if (!VERIFICATION_VALUES.includes(status)) throw new CareError('Statut invalide.');
    const notes = readText(formData, 'notes', 2000);
    const before = await prisma.providerProfile.findUnique({ where: { id: providerId } });
    if (!before) throw new CareError('Prestataire introuvable.', 404);
    await prisma.providerProfile.update({
      where: { id: providerId },
      data: {
        verificationStatus: status,
        verificationNotes: notes || before.verificationNotes,
        verifiedAt: status === 'VERIFIED' ? new Date() : before.verifiedAt,
      },
    });
    await recordAudit({
      adminUserId: admin.id,
      action: 'care.provider.verification',
      entityType: 'ProviderProfile',
      entityId: providerId,
      before: { verificationStatus: before.verificationStatus },
      after: { verificationStatus: status },
    });
    revalidateCare();
    return { ok: true, message: 'Statut de vérification enregistré.' };
  } catch (error) {
    return toActionState(error, 'vérification prestataire');
  }
}

/** Active / désactive un compte (client ou prestataire), ou réinitialise son mot de passe. */
export async function accountAdminAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');
    const accountId = readText(formData, 'accountId', 40);
    const operation = readText(formData, 'operation', 20);
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new CareError('Compte introuvable.', 404);

    if (operation === 'reset-password') {
      const password = temporaryPassword();
      await prisma.account.update({
        where: { id: accountId },
        data: { passwordHash: await hashPassword(password) },
      });
      await recordAudit({
        adminUserId: admin.id,
        action: 'care.account.reset_password',
        entityType: 'Account',
        entityId: accountId,
      });
      return {
        ok: true,
        message: `Nouveau mot de passe temporaire (à transmettre de façon sécurisée) : ${password}`,
      };
    }

    const active = operation === 'activate';
    await prisma.account.update({ where: { id: accountId }, data: { active } });
    await recordAudit({
      adminUserId: admin.id,
      action: active ? 'care.account.activate' : 'care.account.deactivate',
      entityType: 'Account',
      entityId: accountId,
    });
    revalidateCare();
    return { ok: true, message: active ? 'Compte réactivé.' : 'Compte désactivé.' };
  } catch (error) {
    return toActionState(error, 'gestion compte');
  }
}

// ---------------------------------------------------------------------------
// Catalogue : catégories, règles d'entretien, offres
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function saveCategoryAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');
    const id = readText(formData, 'id', 40);
    const name = readText(formData, 'name', 80);
    if (!name) throw new CareError('Nom requis.');
    const priceRaw = readText(formData, 'indicativePriceFrom', 20).replace(/\D/g, '');
    const data = {
      name,
      description: readText(formData, 'description', 500) || null,
      services: splitLines(readText(formData, 'services', 2000)),
      zones: splitList(readText(formData, 'zones', 2000)),
      indicativePriceFrom: priceRaw ? Number.parseInt(priceRaw, 10) : null,
      active: readBool(formData, 'active'),
      displayOrder: readInt(formData, 'displayOrder', 0),
    };
    const saved = id
      ? await prisma.careCategory.update({ where: { id }, data })
      : await prisma.careCategory.create({ data: { ...data, slug: slugify(name) || `categorie-${Date.now()}` } });
    await recordAudit({
      adminUserId: admin.id,
      action: id ? 'care.category.update' : 'care.category.create',
      entityType: 'CareCategory',
      entityId: saved.id,
      after: data,
    });
    revalidateCare();
    return { ok: true, message: 'Catégorie enregistrée.' };
  } catch (error) {
    return toActionState(error, 'catégorie');
  }
}

export async function saveEquipmentTypeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');
    const id = readText(formData, 'id', 40);
    const name = readText(formData, 'name', 80);
    if (!name) throw new CareError('Nom requis.');
    const months = readInt(formData, 'defaultFrequencyMonths', 0);
    const data = {
      name,
      categoryId: readText(formData, 'categoryId', 40) || null,
      defaultFrequencyMonths: months > 0 && months <= 120 ? months : null,
      recommendation: readText(formData, 'recommendation', 500) || null,
      active: readBool(formData, 'active'),
    };
    const saved = id
      ? await prisma.equipmentType.update({ where: { id }, data })
      : await prisma.equipmentType.create({ data: { ...data, slug: slugify(name) || `equipement-${Date.now()}` } });
    await recordAudit({
      adminUserId: admin.id,
      action: id ? 'care.equipment_type.update' : 'care.equipment_type.create',
      entityType: 'EquipmentType',
      entityId: saved.id,
      after: data,
    });
    revalidateCare();
    return { ok: true, message: 'Règle d’entretien enregistrée.' };
  } catch (error) {
    return toActionState(error, 'type équipement');
  }
}

export async function savePlanAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');
    const id = readText(formData, 'id', 40);
    const data = {
      name: readText(formData, 'name', 80),
      monthlyPrice: Math.max(0, readInt(formData, 'monthlyPrice', 0)),
      benefits: splitLines(readText(formData, 'benefits', 2000)),
      active: readBool(formData, 'active'),
    };
    if (!id || !data.name) throw new CareError('Offre invalide.');
    await prisma.carePlan.update({ where: { id }, data });
    await recordAudit({
      adminUserId: admin.id,
      action: 'care.plan.update',
      entityType: 'CarePlan',
      entityId: id,
      after: data,
    });
    revalidateCare();
    return { ok: true, message: 'Offre enregistrée.' };
  } catch (error) {
    return toActionState(error, 'offre');
  }
}

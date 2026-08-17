'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/guard';
import { assertCsrf } from '@/lib/security/csrf';
import { recordAudit } from '@/lib/audit';
import { removeReferential } from '@/lib/services/referentials';
import { setSetting, SETTING_DEFINITION_BY_KEY } from '@/lib/settings';
import { cityZoneSchema, finishLevelSchema, projectTypeSchema } from '@/lib/validation/schemas';
import { readBool, readInt, readText, toActionState, type ActionState } from './shared';

/** Génère un slug stable à partir d'un libellé. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = base || 'element';
  let candidate = root;
  let index = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${index}`;
    index += 1;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Types de projets
// ---------------------------------------------------------------------------

export async function saveProjectTypeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');

    const id = readText(formData, 'id', 64);
    const parsed = projectTypeSchema.safeParse({
      name: readText(formData, 'name', 80),
      description: readText(formData, 'description', 500),
      // Le coefficient est saisi en décimal (1,10) et stocké ×1000.
      coefficient: Math.round(
        Number(readText(formData, 'coefficient', 12).replace(',', '.')) * 1000,
      ),
      active: readBool(formData, 'active'),
      displayOrder: readInt(formData, 'displayOrder', 0),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
    }

    const data = {
      name: parsed.data.name,
      description: parsed.data.description || null,
      coefficient: parsed.data.coefficient,
      active: parsed.data.active,
      displayOrder: parsed.data.displayOrder,
    };

    if (id) {
      const before = await prisma.projectType.findUnique({ where: { id } });
      const after = await prisma.projectType.update({ where: { id }, data });
      await recordAudit({
        adminUserId: admin.id,
        action: 'settings.projectType.update',
        entityType: 'ProjectType',
        entityId: id,
        before,
        after,
      });
    } else {
      const slug = await uniqueSlug(
        slugify(parsed.data.name),
        async (candidate) => (await prisma.projectType.count({ where: { slug: candidate } })) > 0,
      );
      const created = await prisma.projectType.create({ data: { ...data, slug } });
      await recordAudit({
        adminUserId: admin.id,
        action: 'settings.projectType.create',
        entityType: 'ProjectType',
        entityId: created.id,
        after: created,
      });
    }

    revalidatePath('/admin/parametres');
    revalidatePath('/');
    return { ok: true, message: 'Type de projet enregistré.' };
  } catch (error) {
    return toActionState(error, 'enregistrement du type de projet');
  }
}

// ---------------------------------------------------------------------------
// Villes et zones
// ---------------------------------------------------------------------------

export async function saveCityZoneAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');

    const id = readText(formData, 'id', 64);
    const parsed = cityZoneSchema.safeParse({
      name: readText(formData, 'name', 80),
      coefficient: Math.round(
        Number(readText(formData, 'coefficient', 12).replace(',', '.')) * 1000,
      ),
      active: readBool(formData, 'active'),
      displayOrder: readInt(formData, 'displayOrder', 0),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
    }

    const data = {
      name: parsed.data.name,
      coefficient: parsed.data.coefficient,
      active: parsed.data.active,
      displayOrder: parsed.data.displayOrder,
    };

    if (id) {
      const before = await prisma.cityZone.findUnique({ where: { id } });
      const after = await prisma.cityZone.update({ where: { id }, data });
      await recordAudit({
        adminUserId: admin.id,
        action: 'settings.cityZone.update',
        entityType: 'CityZone',
        entityId: id,
        before,
        after,
      });
    } else {
      const slug = await uniqueSlug(
        slugify(parsed.data.name),
        async (candidate) => (await prisma.cityZone.count({ where: { slug: candidate } })) > 0,
      );
      const created = await prisma.cityZone.create({ data: { ...data, slug } });
      await recordAudit({
        adminUserId: admin.id,
        action: 'settings.cityZone.create',
        entityType: 'CityZone',
        entityId: created.id,
        after: created,
      });
    }

    revalidatePath('/admin/parametres');
    revalidatePath('/');
    return { ok: true, message: 'Ville ou zone enregistrée.' };
  } catch (error) {
    return toActionState(error, 'enregistrement de la ville');
  }
}

// ---------------------------------------------------------------------------
// Niveaux de finition
// ---------------------------------------------------------------------------

export async function saveFinishLevelAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');

    const id = readText(formData, 'id', 64);
    const parsed = finishLevelSchema.safeParse({
      name: readText(formData, 'name', 80),
      description: readText(formData, 'description', 500),
      pricePerSquareMeter: readInt(formData, 'pricePerSquareMeter', 0),
      active: readBool(formData, 'active'),
      displayOrder: readInt(formData, 'displayOrder', 0),
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
    }

    const data = {
      name: parsed.data.name,
      description: parsed.data.description || null,
      pricePerSquareMeter: parsed.data.pricePerSquareMeter,
      active: parsed.data.active,
      displayOrder: parsed.data.displayOrder,
    };

    if (id) {
      const before = await prisma.finishLevel.findUnique({ where: { id } });
      const after = await prisma.finishLevel.update({ where: { id }, data });
      await recordAudit({
        adminUserId: admin.id,
        action: 'settings.finishLevel.update',
        entityType: 'FinishLevel',
        entityId: id,
        before,
        after,
      });
    } else {
      const slug = await uniqueSlug(
        slugify(parsed.data.name),
        async (candidate) => (await prisma.finishLevel.count({ where: { slug: candidate } })) > 0,
      );
      const created = await prisma.finishLevel.create({ data: { ...data, slug } });
      await recordAudit({
        adminUserId: admin.id,
        action: 'settings.finishLevel.create',
        entityType: 'FinishLevel',
        entityId: created.id,
        after: created,
      });
    }

    revalidatePath('/admin/parametres');
    revalidatePath('/');
    return { ok: true, message: 'Niveau de finition enregistré.' };
  } catch (error) {
    return toActionState(error, 'enregistrement du niveau de finition');
  }
}

// ---------------------------------------------------------------------------
// Suppression contrôlée d'un référentiel
// ---------------------------------------------------------------------------

/**
 * Un référentiel déjà utilisé par une simulation ne peut pas être supprimé :
 * cela romprait la traçabilité des anciennes estimations. Il est désactivé.
 */
export async function deleteReferentialAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');

    const kind = readText(formData, 'kind', 20);
    if (kind !== 'projectType' && kind !== 'cityZone' && kind !== 'finishLevel') {
      return { ok: false, error: 'Référentiel inconnu.' };
    }

    const result = await removeReferential(kind, readText(formData, 'id', 64), admin.id);

    revalidatePath('/admin/parametres');
    revalidatePath('/');
    return { ok: true, message: result.message };
  } catch (error) {
    return toActionState(error, 'suppression du référentiel');
  }
}

// ---------------------------------------------------------------------------
// Paramètres applicatifs
// ---------------------------------------------------------------------------

export async function saveAppSettingsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('ADMIN');

    const keys = formData.getAll('settingKey').map(String);
    const changes: { key: string; value: string }[] = [];

    for (const key of keys) {
      const definition = SETTING_DEFINITION_BY_KEY.get(key);
      if (!definition) continue;

      const raw = formData.get(`value:${key}`);
      let value: string;

      switch (definition.type) {
        case 'BOOLEAN':
          value = raw === 'on' || raw === 'true' ? 'true' : 'false';
          break;
        case 'INTEGER': {
          const parsed = Number.parseInt(String(raw ?? '').replace(/[^\d-]/g, ''), 10);
          if (!Number.isFinite(parsed)) {
            return { ok: false, error: `Valeur numérique invalide pour « ${definition.label} ».` };
          }
          if (
            (definition.min !== undefined && parsed < definition.min) ||
            (definition.max !== undefined && parsed > definition.max)
          ) {
            return {
              ok: false,
              error: `« ${definition.label} » doit être compris entre ${definition.min} et ${definition.max}.`,
            };
          }
          value = String(parsed);
          break;
        }
        case 'JSON': {
          const lines = String(raw ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          value = JSON.stringify(lines);
          break;
        }
        default:
          value = String(raw ?? '').slice(0, 8000);
      }

      changes.push({ key, value });
    }

    const before = await prisma.appSetting.findMany({
      where: { key: { in: changes.map((change) => change.key) } },
      select: { key: true, value: true },
    });

    for (const change of changes) {
      await setSetting(change.key, change.value);
    }

    await recordAudit({
      adminUserId: admin.id,
      action: 'settings.app.update',
      entityType: 'AppSetting',
      before,
      after: changes,
    });

    revalidatePath('/admin/parametres');
    revalidatePath('/');
    return { ok: true, message: `${changes.length} paramètre(s) enregistré(s).` };
  } catch (error) {
    return toActionState(error, 'enregistrement des paramètres');
  }
}

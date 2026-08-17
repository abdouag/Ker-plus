import 'server-only';

import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';

export type ReferentialKind = 'projectType' | 'cityZone' | 'finishLevel';

export interface ReferentialRemovalResult {
  deleted: boolean;
  deactivated: boolean;
  usageCount: number;
  message: string;
}

/** Nombre de simulations référençant un élément de référentiel. */
export async function countReferentialUsage(kind: ReferentialKind, id: string): Promise<number> {
  return prisma.simulation.count({
    where:
      kind === 'projectType'
        ? { projectTypeId: id }
        : kind === 'cityZone'
          ? { cityZoneId: id }
          : { finishLevelId: id },
  });
}

/**
 * Supprime un élément de référentiel s'il n'a jamais servi ; sinon le
 * désactive. Une suppression romprait la traçabilité des estimations déjà
 * réalisées : elle est donc toujours refusée dans ce cas.
 */
export async function removeReferential(
  kind: ReferentialKind,
  id: string,
  adminUserId: string,
): Promise<ReferentialRemovalResult> {
  const usageCount = await countReferentialUsage(kind, id);

  if (usageCount > 0) {
    if (kind === 'projectType') {
      await prisma.projectType.update({ where: { id }, data: { active: false } });
    } else if (kind === 'cityZone') {
      await prisma.cityZone.update({ where: { id }, data: { active: false } });
    } else {
      await prisma.finishLevel.update({ where: { id }, data: { active: false } });
    }

    await recordAudit({
      adminUserId,
      action: `settings.${kind}.deactivate`,
      entityType: kind,
      entityId: id,
      after: { active: false, reason: 'utilisé par des simulations existantes' },
    });

    return {
      deleted: false,
      deactivated: true,
      usageCount,
      message: `Élément utilisé par ${usageCount} simulation(s) : il a été désactivé plutôt que supprimé, afin de préserver l’historique.`,
    };
  }

  if (kind === 'projectType') {
    await prisma.projectType.delete({ where: { id } });
  } else if (kind === 'cityZone') {
    await prisma.cityZone.delete({ where: { id } });
  } else {
    await prisma.finishLevel.delete({ where: { id } });
  }

  await recordAudit({
    adminUserId,
    action: `settings.${kind}.delete`,
    entityType: kind,
    entityId: id,
  });

  return { deleted: true, deactivated: false, usageCount: 0, message: 'Élément supprimé.' };
}

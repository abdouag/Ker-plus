'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/guard';
import { assertCsrf } from '@/lib/security/csrf';
import { recordAudit } from '@/lib/audit';
import { readText, toActionState, type ActionState } from './shared';

/** Met à jour les notes internes d'un client. */
export async function updateCustomerNotesAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await assertCsrf(formData);
    const admin = await requireRole('MANAGER');

    const customerId = readText(formData, 'customerId', 64);
    const notes = readText(formData, 'internalNotes', 4000);

    const before = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!before) return { ok: false, error: 'Client introuvable.' };

    await prisma.customer.update({
      where: { id: customerId },
      data: { internalNotes: notes || null },
    });

    await recordAudit({
      adminUserId: admin.id,
      action: 'customer.notes.update',
      entityType: 'Customer',
      entityId: customerId,
      before: { internalNotes: before.internalNotes },
      after: { internalNotes: notes },
    });

    revalidatePath('/admin/clients');
    return { ok: true, message: 'Notes enregistrées.' };
  } catch (error) {
    return toActionState(error, 'mise à jour des notes client');
  }
}

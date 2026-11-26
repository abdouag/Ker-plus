import 'server-only';

import type { ActorType, Prisma, RequestStatus } from '@prisma/client';
import { assertTransition } from '../workflow';
import { CareError } from '../errors';

/** Acteur à l'origine d'une opération — toujours déterminé côté serveur. */
export type CareActor =
  | { type: 'CLIENT'; accountId: string }
  | { type: 'PROVIDER'; accountId: string; providerId: string }
  | { type: 'ADMIN'; adminId: string }
  | { type: 'SYSTEM' };

export type Tx = Prisma.TransactionClient;

export function actorFields(actor: CareActor): {
  actorType: ActorType;
  actorAccountId: string | null;
  actorAdminId: string | null;
} {
  return {
    actorType: actor.type,
    actorAccountId: actor.type === 'CLIENT' || actor.type === 'PROVIDER' ? actor.accountId : null,
    actorAdminId: actor.type === 'ADMIN' ? actor.adminId : null,
  };
}

/**
 * Applique une transition de statut de manière atomique :
 *  - vérifie que la transition est autorisée pour cet acteur ;
 *  - met à jour la demande uniquement si son statut n'a pas changé entre-temps
 *    (verrou optimiste) ;
 *  - journalise l'événement horodaté avec l'acteur et le motif.
 */
export async function transitionRequest(
  tx: Tx,
  request: { id: string; status: RequestStatus },
  to: RequestStatus,
  actor: CareActor,
  options: { reason?: string | null; data?: Prisma.ServiceRequestUpdateManyMutationInput } = {},
): Promise<void> {
  assertTransition(request.status, to, actor.type);
  const updated = await tx.serviceRequest.updateMany({
    where: { id: request.id, status: request.status },
    data: { ...options.data, status: to },
  });
  if (updated.count !== 1) {
    throw new CareError('La demande a été modifiée entre-temps. Rechargez la page.', 409);
  }
  await tx.requestStatusEvent.create({
    data: {
      requestId: request.id,
      fromStatus: request.status,
      toStatus: to,
      reason: options.reason ?? null,
      ...actorFields(actor),
    },
  });
}

/** Journalise un événement sans changement de statut (devis, rendez-vous…). */
export async function logRequestEvent(
  tx: Tx,
  request: { id: string; status: RequestStatus },
  actor: CareActor,
  reason: string,
): Promise<void> {
  await tx.requestStatusEvent.create({
    data: {
      requestId: request.id,
      fromStatus: request.status,
      toStatus: request.status,
      reason,
      ...actorFields(actor),
    },
  });
}

import type { ActorType, RequestStatus } from '@prisma/client';

/**
 * Machine à états des demandes d'intervention Kër Care.
 *
 * Chaque transition autorisée déclare les acteurs habilités à la déclencher.
 * Les services vérifient systématiquement la transition côté serveur avant
 * toute mutation : un bouton masqué dans l'interface ne suffit jamais.
 *
 * Le statut d'intervention est indépendant de tout statut de paiement.
 */

type Rule = { from: RequestStatus[]; to: RequestStatus; actors: ActorType[] };

const BEFORE_SCHEDULING: RequestStatus[] = [
  'SUBMITTED',
  'SEARCHING',
  'ASSIGNED',
  'ACCEPTED',
  'QUOTE_SENT',
  'QUOTE_REFUSED',
  'QUOTE_ACCEPTED',
];

export const TRANSITIONS: Rule[] = [
  { from: ['SUBMITTED'], to: 'SEARCHING', actors: ['ADMIN'] },
  // Affectation initiale ou réaffectation par l'administration.
  {
    from: ['SUBMITTED', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'QUOTE_SENT', 'QUOTE_REFUSED'],
    to: 'ASSIGNED',
    actors: ['ADMIN'],
  },
  { from: ['ASSIGNED'], to: 'ACCEPTED', actors: ['PROVIDER'] },
  // Refus du prestataire ou retrait par l'administration.
  {
    from: ['ASSIGNED', 'ACCEPTED', 'QUOTE_SENT', 'QUOTE_REFUSED'],
    to: 'SEARCHING',
    actors: ['PROVIDER', 'ADMIN'],
  },
  { from: ['ACCEPTED', 'QUOTE_REFUSED'], to: 'QUOTE_SENT', actors: ['PROVIDER'] },
  { from: ['QUOTE_SENT'], to: 'QUOTE_ACCEPTED', actors: ['CLIENT'] },
  { from: ['QUOTE_SENT'], to: 'QUOTE_REFUSED', actors: ['CLIENT'] },
  { from: ['QUOTE_ACCEPTED'], to: 'SCHEDULED', actors: ['CLIENT', 'ADMIN'] },
  // Report ou annulation du rendez-vous : retour à « devis accepté ».
  { from: ['SCHEDULED'], to: 'QUOTE_ACCEPTED', actors: ['CLIENT', 'PROVIDER', 'ADMIN'] },
  { from: ['SCHEDULED'], to: 'EN_ROUTE', actors: ['PROVIDER', 'ADMIN'] },
  { from: ['SCHEDULED', 'EN_ROUTE'], to: 'ARRIVED', actors: ['PROVIDER', 'ADMIN'] },
  { from: ['ARRIVED'], to: 'IN_PROGRESS', actors: ['PROVIDER', 'ADMIN'] },
  // Déclenchée par le dépôt du rapport de fin d'intervention.
  { from: ['IN_PROGRESS'], to: 'WORK_DONE', actors: ['PROVIDER'] },
  { from: ['WORK_DONE'], to: 'VALIDATED', actors: ['CLIENT'] },
  { from: ['WORK_DONE'], to: 'DISPUTED', actors: ['CLIENT'] },
  // Contestation : reprise de l'intervention ou clôture après arbitrage.
  { from: ['DISPUTED'], to: 'IN_PROGRESS', actors: ['ADMIN'] },
  { from: ['DISPUTED', 'VALIDATED'], to: 'CLOSED', actors: ['ADMIN', 'SYSTEM'] },
  { from: BEFORE_SCHEDULING, to: 'CANCELLED', actors: ['CLIENT', 'ADMIN'] },
  {
    from: ['SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'],
    to: 'CANCELLED',
    actors: ['ADMIN'],
  },
];

export const TERMINAL_STATUSES: RequestStatus[] = ['CLOSED', 'CANCELLED'];

/** Statuts pendant lesquels un rendez-vous d'intervention est actif. */
export const ON_SITE_STATUSES: RequestStatus[] = [
  'SCHEDULED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
];

/** Statuts considérés comme « en cours » pour les tableaux de bord. */
export const ACTIVE_STATUSES: RequestStatus[] = [
  'SUBMITTED',
  'SEARCHING',
  'ASSIGNED',
  'ACCEPTED',
  'QUOTE_SENT',
  'QUOTE_REFUSED',
  'QUOTE_ACCEPTED',
  'SCHEDULED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'WORK_DONE',
  'DISPUTED',
];

export function canTransition(from: RequestStatus, to: RequestStatus, actor: ActorType): boolean {
  return TRANSITIONS.some(
    (rule) => rule.to === to && rule.from.includes(from) && rule.actors.includes(actor),
  );
}

export class TransitionError extends Error {
  readonly status = 409;
  constructor(from: RequestStatus, to: RequestStatus) {
    super(`Action impossible dans l’état actuel de la demande (${from} → ${to}).`);
    this.name = 'TransitionError';
  }
}

export function assertTransition(from: RequestStatus, to: RequestStatus, actor: ActorType): void {
  if (!canTransition(from, to, actor)) {
    throw new TransitionError(from, to);
  }
}

/** Transitions disponibles pour un acteur à partir d'un statut donné. */
export function availableTransitions(from: RequestStatus, actor: ActorType): RequestStatus[] {
  return TRANSITIONS.filter((rule) => rule.from.includes(from) && rule.actors.includes(actor)).map(
    (rule) => rule.to,
  );
}

import type {
  AppointmentStatus,
  AppointmentType,
  AssignmentStatus,
  AttachmentKind,
  MaintenanceStatus,
  PropertyType,
  QuoteStatus,
  RequestKind,
  RequestStatus,
  VerificationStatus,
} from '@prisma/client';

/**
 * Libellés et constantes d'affichage du module Kër Care.
 * Source unique : l'interface client, prestataire et admin s'y réfèrent.
 */

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  VILLA: 'Villa',
  MAISON: 'Maison',
  APPARTEMENT: 'Appartement',
  IMMEUBLE: 'Immeuble',
  AUTRE: 'Autre',
};

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  PLANNED: 'Intervention planifiée',
  QUICK_REPAIR: 'Dépannage rapide',
  EMERGENCY: 'Danger immédiat',
};

export const REQUEST_KIND_HINTS: Record<RequestKind, string> = {
  PLANNED: 'Entretien ou petits travaux, à programmer selon vos disponibilités.',
  QUICK_REPAIR: 'Une panne gênante à traiter dès que possible (fuite, coupure, climatiseur…).',
  EMERGENCY: 'Odeur de gaz, fumée, étincelles, risque d’électrocution ou d’effondrement.',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  SUBMITTED: 'Demande reçue',
  SEARCHING: 'Recherche d’un prestataire',
  ASSIGNED: 'Prestataire proposé',
  ACCEPTED: 'Prise en charge acceptée',
  QUOTE_SENT: 'Devis à valider',
  QUOTE_REFUSED: 'Devis refusé',
  QUOTE_ACCEPTED: 'Devis accepté',
  SCHEDULED: 'Rendez-vous confirmé',
  EN_ROUTE: 'Prestataire en route',
  ARRIVED: 'Prestataire arrivé',
  IN_PROGRESS: 'Intervention en cours',
  WORK_DONE: 'Travaux déclarés terminés',
  VALIDATED: 'Validée par vous',
  DISPUTED: 'Contestée',
  CLOSED: 'Clôturée',
  CANCELLED: 'Annulée',
};

export const REQUEST_STATUS_TONES: Record<RequestStatus, Tone> = {
  SUBMITTED: 'info',
  SEARCHING: 'info',
  ASSIGNED: 'info',
  ACCEPTED: 'info',
  QUOTE_SENT: 'warning',
  QUOTE_REFUSED: 'neutral',
  QUOTE_ACCEPTED: 'success',
  SCHEDULED: 'success',
  EN_ROUTE: 'success',
  ARRIVED: 'success',
  IN_PROGRESS: 'success',
  WORK_DONE: 'warning',
  VALIDATED: 'success',
  DISPUTED: 'danger',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

/** Prochaine action attendue, du point de vue du client. */
export const REQUEST_NEXT_STEP_CLIENT: Record<RequestStatus, string> = {
  SUBMITTED: 'Kerplus étudie votre demande et recherche un prestataire vérifié.',
  SEARCHING: 'Kerplus recherche un prestataire vérifié disponible.',
  ASSIGNED: 'Un prestataire a été sollicité ; il doit confirmer sa prise en charge.',
  ACCEPTED:
    'Le prestataire va vous proposer un devis ou, si nécessaire, une visite de diagnostic.',
  QUOTE_SENT: 'Consultez le devis puis acceptez-le ou refusez-le.',
  QUOTE_REFUSED: 'Le prestataire peut proposer un devis révisé. Vous pouvez aussi annuler.',
  QUOTE_ACCEPTED: 'Le prestataire va proposer un créneau d’intervention à confirmer.',
  SCHEDULED: 'Le rendez-vous est confirmé. Le prestataire interviendra au créneau prévu.',
  EN_ROUTE: 'Le prestataire est en route.',
  ARRIVED: 'Le prestataire est sur place.',
  IN_PROGRESS: 'L’intervention est en cours.',
  WORK_DONE: 'Consultez le rapport puis validez l’intervention ou contestez-la.',
  VALIDATED: 'Merci ! Vous pouvez laisser un avis sur l’intervention.',
  DISPUTED: 'Kerplus examine votre contestation et revient vers vous.',
  CLOSED: 'Intervention clôturée. Elle figure dans le carnet de votre logement.',
  CANCELLED: 'Cette demande a été annulée.',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  PENDING: 'En attente de réponse',
  ACCEPTED: 'Acceptée',
  REFUSED: 'Refusée',
  WITHDRAWN: 'Retirée',
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  SENT: 'À valider',
  ACCEPTED: 'Accepté',
  REFUSED: 'Refusé',
  SUPERSEDED: 'Remplacé',
};

export const QUOTE_STATUS_TONES: Record<QuoteStatus, Tone> = {
  SENT: 'warning',
  ACCEPTED: 'success',
  REFUSED: 'danger',
  SUPERSEDED: 'neutral',
};

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  DIAGNOSTIC: 'Visite de diagnostic',
  INTERVENTION: 'Intervention',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROPOSED: 'Proposé — à confirmer',
  CONFIRMED: 'Confirmé',
  CANCELLED: 'Annulé',
  DONE: 'Effectué',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'Vérification en attente',
  VERIFIED: 'Vérifié',
  REFUSED: 'Refusé',
  SUSPENDED: 'Suspendu',
};

export const VERIFICATION_STATUS_TONES: Record<VerificationStatus, Tone> = {
  PENDING: 'warning',
  VERIFIED: 'success',
  REFUSED: 'danger',
  SUSPENDED: 'danger',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  TODO: 'À prévoir',
  PLANNED: 'Planifié',
  DONE: 'Effectué',
  CANCELLED: 'Annulé',
};

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  PHOTO: 'Photo',
  PHOTO_BEFORE: 'Photo avant',
  PHOTO_AFTER: 'Photo après',
  PLAN: 'Plan',
  INVOICE: 'Facture',
  WARRANTY: 'Garantie',
  OTHER: 'Autre document',
};

/** Types de documents qu'un client peut déposer dans le carnet. */
export const PROPERTY_DOCUMENT_KINDS: AttachmentKind[] = [
  'PLAN',
  'INVOICE',
  'WARRANTY',
  'PHOTO',
  'OTHER',
];

/** Créneaux proposés dans le formulaire de demande. */
export const PREFERRED_SLOTS = [
  { value: 'matin', label: 'Matin (8 h – 12 h)' },
  { value: 'apres-midi', label: 'Après-midi (12 h – 16 h)' },
  { value: 'fin-de-journee', label: 'Fin de journée (16 h – 19 h)' },
  { value: 'indifferent', label: 'Indifférent' },
] as const;

export const PREFERRED_SLOT_LABELS: Record<string, string> = Object.fromEntries(
  PREFERRED_SLOTS.map((slot) => [slot.value, slot.label]),
);

/** Fichiers : formats et tailles autorisés. */
export const CARE_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  maxFilesPerSubmit: 4,
  imageTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  documentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
};

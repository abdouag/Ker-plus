/**
 * Catalogue d'événements analytics.
 * La logique métier n'appelle jamais un SDK directement : elle émet un
 * événement de ce catalogue, que l'adaptateur configuré relaie.
 */
export const ANALYTICS_EVENTS = {
  estimatorViewed: 'estimator_viewed',
  estimatorStarted: 'estimator_started',
  estimateCompleted: 'estimate_completed',
  leadSubmitted: 'lead_submitted',
  checkoutStarted: 'checkout_started',
  paymentPending: 'payment_pending',
  paymentConfirmed: 'payment_confirmed',
  reportDownloaded: 'report_downloaded',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

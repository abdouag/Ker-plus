'use client';

import { useEffect } from 'react';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';

/**
 * Émet l'événement analytics correspondant à l'état RÉEL du paiement, tel que
 * déterminé par le serveur. Le navigateur ne décide jamais de cet état.
 */
export function PaymentTracker({ paid, amount }: { paid: boolean; amount: number }) {
  useEffect(() => {
    trackEvent(paid ? ANALYTICS_EVENTS.paymentConfirmed : ANALYTICS_EVENTS.paymentPending, {
      amount,
    });
  }, [paid, amount]);

  return null;
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  denyAnalyticsConsent,
  grantAnalyticsConsent,
  hasAnsweredConsent,
} from '@/lib/analytics/client';
import { Button } from '@/components/ui/Button';

/**
 * Bandeau de consentement.
 * Aucun traceur non essentiel n'est chargé tant que le visiteur n'a pas
 * accepté. Le bandeau ne s'affiche que si un fournisseur analytics est
 * réellement configuré.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? 'none';
    if (provider === 'none' || provider === 'console') return;
    if (hasAnsweredConsent()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement aux mesures d’audience"
      className="kp-no-print fixed inset-x-0 bottom-0 z-50 border-t border-sand-300 bg-white p-4 shadow-raised"
    >
      <div className="mx-auto flex max-w-content flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft">
          Nous utilisons des mesures d’audience pour améliorer l’estimateur. Aucun traceur n’est
          activé sans votre accord.{' '}
          <Link href="/politique-de-confidentialite" className="font-semibold underline">
            En savoir plus
          </Link>
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              denyAnalyticsConsent();
              setVisible(false);
            }}
          >
            Refuser
          </Button>
          <Button
            size="sm"
            onClick={() => {
              grantAnalyticsConsent();
              setVisible(false);
            }}
          >
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}

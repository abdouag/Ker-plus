'use client';

import type { AnalyticsEvent, AnalyticsPayload } from './events';

/**
 * Adaptateur analytics côté navigateur.
 *
 * Aucun traceur tiers n'est chargé tant que l'utilisateur n'a pas donné son
 * consentement (cookie `kerplus_consent=granted`) et qu'aucun fournisseur
 * n'est configuré. Ajouter GA4, Meta Pixel ou PostHog consiste à compléter le
 * `switch` ci-dessous, sans toucher au code métier.
 */

const CONSENT_COOKIE = 'kerplus_consent';

type WindowWithTrackers = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  posthog?: { capture: (event: string, payload?: AnalyticsPayload) => void };
};

export function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${CONSENT_COOKIE}=granted`);
}

export function grantAnalyticsConsent(): void {
  const oneYear = 365 * 24 * 3600;
  document.cookie = `${CONSENT_COOKIE}=granted; path=/; max-age=${oneYear}; samesite=lax`;
}

export function denyAnalyticsConsent(): void {
  const sixMonths = 182 * 24 * 3600;
  document.cookie = `${CONSENT_COOKIE}=denied; path=/; max-age=${sixMonths}; samesite=lax`;
}

export function hasAnsweredConsent(): boolean {
  if (typeof document === 'undefined') return true;
  return document.cookie.split(';').some((part) => part.trim().startsWith(`${CONSENT_COOKIE}=`));
}

/** Émet un événement analytics. Silencieux si aucun fournisseur n'est actif. */
export function trackEvent(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  if (typeof window === 'undefined') return;

  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? 'none';
  if (provider === 'none') return;
  if (provider !== 'console' && !hasAnalyticsConsent()) return;

  const target = window as WindowWithTrackers;

  switch (provider) {
    case 'console':
      console.info('[analytics]', event, payload);
      break;
    case 'ga4':
      target.gtag?.('event', event, payload);
      break;
    case 'meta':
      target.fbq?.('trackCustom', event, payload);
      break;
    case 'posthog':
      target.posthog?.capture(event, payload);
      break;
    default:
      break;
  }
}

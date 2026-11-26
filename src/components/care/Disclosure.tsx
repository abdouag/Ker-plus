'use client';

import { useState, type ReactNode } from 'react';

/**
 * Volet repliable dont l'état initial est fixé au premier rendu.
 *
 * Contrairement à `<details open={…}>` piloté par le serveur, l'ouverture ne
 * change plus après une action : un formulaire qui vient d'être envoyé reste
 * visible avec son message de confirmation.
 */
export function Disclosure({
  defaultOpen = false,
  className,
  summary,
  summaryClassName,
  children,
}: {
  defaultOpen?: boolean;
  className?: string;
  summary: ReactNode;
  summaryClassName?: string;
  children: ReactNode;
}) {
  const [initiallyOpen] = useState(defaultOpen);
  return (
    <details className={className} open={initiallyOpen}>
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}

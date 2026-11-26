'use client';

import { useActionState, type FormEvent, type ReactNode } from 'react';
import type { CareActionState } from '@/app/ker-care/actions/shared';
import { CSRF_FIELD } from '@/lib/security/csrf-field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';

export type CareAction = (state: CareActionState, formData: FormData) => Promise<CareActionState>;

/**
 * Formulaire Kër Care (client et prestataire) : jeton CSRF, état d'envoi,
 * message de retour et confirmation facultative des actions importantes.
 * Le bouton est désactivé pendant l'envoi (pas de double soumission).
 */
export function CareForm({
  action,
  csrfToken,
  children,
  submitLabel,
  variant = 'primary',
  size = 'md',
  confirmMessage,
  hidden,
  className,
  fullWidthSubmit,
  resetOnSuccess,
  submitClassName,
}: {
  action: CareAction;
  csrfToken: string;
  children?: ReactNode;
  submitLabel: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  confirmMessage?: string;
  hidden?: Record<string, string>;
  className?: string;
  fullWidthSubmit?: boolean;
  /** Vide le formulaire après succès (ajout d'élément dans une liste). */
  resetOnSuccess?: boolean;
  submitClassName?: string;
}) {
  const [state, formAction, pending] = useActionState<CareActionState, FormData>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      return result;
    },
    {},
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className={className}
      key={resetOnSuccess && state.ok ? state.message : undefined}
    >
      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {children}

      {state.error ? (
        <Alert tone="danger" className="mt-3">
          {state.error}
        </Alert>
      ) : null}
      {state.ok && state.message ? (
        <Alert tone="success" className="mt-3" role="status">
          {state.message}
        </Alert>
      ) : null}

      <div className="mt-3">
        <Button
          type="submit"
          variant={variant}
          size={size}
          loading={pending}
          fullWidth={fullWidthSubmit}
          className={submitClassName}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

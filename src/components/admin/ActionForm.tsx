'use client';

import { useActionState, type FormEvent, type ReactNode } from 'react';
import type { ActionState } from '@/app/admin/actions/shared';
import { CSRF_FIELD } from '@/lib/security/csrf-field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';

export type AdminAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Enveloppe commune aux formulaires d'administration :
 * jeton CSRF, état de soumission, message de retour et confirmation
 * éventuelle pour les opérations sensibles.
 */
export function ActionForm({
  action,
  csrfToken,
  children,
  submitLabel,
  variant = 'secondary',
  size = 'md',
  confirmMessage,
  hidden,
  className,
  fullWidthSubmit,
}: {
  action: AdminAction;
  csrfToken: string;
  children?: ReactNode;
  submitLabel: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  confirmMessage?: string;
  hidden?: Record<string, string>;
  className?: string;
  fullWidthSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className={className}>
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
        <Alert tone="success" className="mt-3">
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
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

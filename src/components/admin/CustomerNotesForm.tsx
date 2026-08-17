'use client';

import { useActionState } from 'react';
import { updateCustomerNotesAction } from '@/app/admin/actions/customers';
import type { ActionState } from '@/app/admin/actions/shared';
import { CSRF_FIELD } from '@/lib/security/csrf-field';
import { Button } from '@/components/ui/Button';

export function CustomerNotesForm({
  customerId,
  notes,
  csrfToken,
}: {
  customerId: string;
  notes: string;
  csrfToken: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateCustomerNotesAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name="customerId" value={customerId} />
      <label
        htmlFor={`notes-${customerId}`}
        className="text-xs font-semibold uppercase text-ink-muted"
      >
        Notes internes
      </label>
      <textarea
        id={`notes-${customerId}`}
        name="internalNotes"
        defaultValue={notes}
        rows={4}
        maxLength={4000}
        className="w-full rounded-xl border border-sand-300 p-3 text-sm focus:border-forest-500"
        placeholder="Contexte, échanges, suivi commercial…"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="ghost" loading={pending}>
          Enregistrer
        </Button>
        {state.ok ? <span className="text-sm text-emerald-700">{state.message}</span> : null}
        {state.error ? <span className="text-sm text-red-700">{state.error}</span> : null}
      </div>
    </form>
  );
}

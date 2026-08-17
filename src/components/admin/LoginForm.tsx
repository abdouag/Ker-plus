'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '@/app/admin/actions/auth';
import { CSRF_FIELD } from '@/lib/security/csrf-field';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';

export function LoginForm({ csrfToken, next }: { csrfToken: string; next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <Alert tone="danger" title="Connexion impossible">
          {state.error}
        </Alert>
      ) : null}

      <TextField
        label="Adresse email"
        name="email"
        type="email"
        required
        autoComplete="username"
        autoFocus
      />
      <TextField
        label="Mot de passe"
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />

      <Button type="submit" size="lg" fullWidth loading={pending}>
        Se connecter
      </Button>
    </form>
  );
}

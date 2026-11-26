'use client';

import { accountLoginAction } from '@/app/compte/actions';
import { CareForm } from '@/components/care/CareForm';
import { TextField } from '@/components/ui/Field';

export function AccountLoginForm({ csrfToken, next }: { csrfToken: string; next: string }) {
  return (
    <CareForm
      action={accountLoginAction}
      csrfToken={csrfToken}
      hidden={{ next }}
      submitLabel="Se connecter"
      fullWidthSubmit
      className="space-y-4"
    >
      <TextField
        label="Adresse email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={160}
      />
      <TextField
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={200}
      />
    </CareForm>
  );
}

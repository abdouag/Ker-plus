'use client';

import Link from 'next/link';
import { signupAction } from '@/app/compte/actions';
import { CareForm } from '@/components/care/CareForm';
import { CheckboxField, TextField } from '@/components/ui/Field';

export function AccountSignupForm({ csrfToken, next }: { csrfToken: string; next: string }) {
  return (
    <CareForm
      action={signupAction}
      csrfToken={csrfToken}
      hidden={{ next }}
      submitLabel="Créer mon compte"
      fullWidthSubmit
      className="space-y-4"
    >
      <TextField
        label="Nom complet"
        name="name"
        autoComplete="name"
        required
        minLength={2}
        maxLength={120}
      />
      <TextField
        label="Adresse email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={160}
      />
      <TextField
        label="Téléphone"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="77 123 45 67"
        hint="Utilisé par Kerplus et le prestataire retenu pour organiser l’intervention."
        required
        maxLength={40}
      />
      <TextField
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum, avec au moins une lettre et un chiffre."
        required
        minLength={8}
        maxLength={200}
      />
      <CheckboxField
        name="consent"
        required
        label={
          <>
            J’accepte les{' '}
            <Link href="/conditions-generales" className="font-semibold text-forest-600 underline">
              conditions générales
            </Link>{' '}
            et la{' '}
            <Link
              href="/politique-de-confidentialite"
              className="font-semibold text-forest-600 underline"
            >
              politique de confidentialité
            </Link>
            . Mes données servent uniquement à gérer mon logement et mes demandes.
          </>
        }
      />
    </CareForm>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { customerSchema } from '@/lib/validation/schemas';
import { formatXOF } from '@/lib/format';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/Card';
import { CheckboxField, TextAreaField, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Feedback';

interface LeadFormProps {
  amount: number;
  deliveryHours: number;
  estimation: {
    projectTypeId: string;
    surface: number;
    cityZoneId: string;
    finishLevelId: string;
    simulationReference?: string;
  };
  defaultCity: string;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<string, string>>;

/** Récupère les paramètres UTM présents dans l'URL courante. */
function readUtm(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') ?? undefined,
    utmMedium: params.get('utm_medium') ?? undefined,
    utmCampaign: params.get('utm_campaign') ?? undefined,
  };
}

export function LeadForm({
  amount,
  deliveryHours,
  estimation,
  defaultCity,
  onCancel,
}: LeadFormProps) {
  const router = useRouter();
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalError(null);
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const raw = {
      firstName: String(formData.get('firstName') ?? ''),
      lastName: String(formData.get('lastName') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      whatsappSameAsPhone: sameAsPhone,
      whatsapp: String(formData.get('whatsapp') ?? ''),
      email: String(formData.get('email') ?? ''),
      city: String(formData.get('city') ?? ''),
      desiredStartDate: String(formData.get('desiredStartDate') ?? ''),
      comment: String(formData.get('comment') ?? ''),
      acceptTerms: formData.get('acceptTerms') === 'on',
      consentData: formData.get('consentData') === 'on',
    };

    // Validation client : mêmes règles que le serveur, retour immédiat.
    const parsed = customerSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue: z.ZodIssue) => {
        const key = String(issue.path[0] ?? 'global');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      setGlobalError('Certaines informations doivent être corrigées.');
      return;
    }

    setSubmitting(true);
    trackEvent(ANALYTICS_EVENTS.leadSubmitted);

    try {
      const response = await fetch('/api/commandes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...raw,
          ...estimation,
          ...readUtm(),
          website: String(formData.get('website') ?? ''),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        orderReference?: string;
        message?: string;
        fieldErrors?: FieldErrors;
      };

      if (!response.ok || !data.ok || !data.orderReference) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setGlobalError(data.message ?? 'La commande n’a pas pu être créée. Réessayez.');
        setSubmitting(false);
        return;
      }

      trackEvent(ANALYTICS_EVENTS.paymentPending, { amount });
      router.push(`/commande/${data.orderReference}`);
    } catch {
      setGlobalError('Connexion impossible. Vérifiez votre réseau puis réessayez.');
      setSubmitting(false);
    }
  }

  return (
    <Card as="section" className="animate-fade-in-up">
      <CardHeader
        title="Vos coordonnées"
        description={`Rapport technique détaillé — ${formatXOF(amount)}. Livraison sous ${deliveryHours} h après confirmation du paiement.`}
      />
      <form onSubmit={handleSubmit} noValidate>
        <CardBody className="space-y-5">
          {globalError ? (
            <Alert tone="danger" title="Vérifiez votre saisie">
              {globalError}
            </Alert>
          ) : null}

          {/* Champ leurre anti-spam : invisible pour les humains. */}
          <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
            <label htmlFor="website">Ne pas remplir</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Prénom"
              name="firstName"
              required
              autoComplete="given-name"
              error={errors.firstName}
            />
            <TextField
              label="Nom"
              name="lastName"
              required
              autoComplete="family-name"
              error={errors.lastName}
            />
            <TextField
              label="Téléphone"
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="77 123 45 67"
              hint="Format sénégalais ou international (diaspora)."
              error={errors.phone}
            />
            <TextField
              label="Adresse email"
              name="email"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              error={errors.email}
            />
          </div>

          <div className="space-y-3">
            <CheckboxField
              label="Mon numéro WhatsApp est identique à mon téléphone"
              name="whatsappSameAsPhone"
              checked={sameAsPhone}
              onChange={(event) => setSameAsPhone(event.target.checked)}
            />
            {!sameAsPhone ? (
              <TextField
                label="Numéro WhatsApp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="+221 77 123 45 67"
                error={errors.whatsapp}
              />
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Ville du projet"
              name="city"
              required
              defaultValue={defaultCity}
              error={errors.city}
            />
            <TextField
              label="Date souhaitée de démarrage"
              name="desiredStartDate"
              type="date"
              hint="Facultatif"
              error={errors.desiredStartDate}
            />
          </div>

          <TextAreaField
            label="Commentaire sur votre projet"
            name="comment"
            hint="Facultatif — terrain, contraintes, plans existants, priorités…"
            maxLength={2000}
            error={errors.comment}
          />

          <div className="space-y-3 rounded-xl bg-sand-50 p-4">
            <CheckboxField
              name="acceptTerms"
              error={errors.acceptTerms}
              label={
                <>
                  J’accepte les{' '}
                  <Link
                    href="/conditions-generales"
                    className="font-semibold underline"
                    target="_blank"
                  >
                    conditions générales
                  </Link>{' '}
                  et les{' '}
                  <Link
                    href="/conditions-rapport"
                    className="font-semibold underline"
                    target="_blank"
                  >
                    conditions du rapport Kerplus
                  </Link>
                  .
                </>
              }
            />
            <CheckboxField
              name="consentData"
              error={errors.consentData}
              label={
                <>
                  J’autorise Kerplus à traiter mes données pour répondre à ma demande, conformément
                  à la{' '}
                  <Link
                    href="/politique-de-confidentialite"
                    className="font-semibold underline"
                    target="_blank"
                  >
                    politique de confidentialité
                  </Link>
                  .
                </>
              }
            />
          </div>
        </CardBody>

        <CardFooter className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button type="submit" size="lg" loading={submitting} className="sm:flex-1">
            Commander mon rapport – {formatXOF(amount)}
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onCancel} disabled={submitting}>
            Modifier mon estimation
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

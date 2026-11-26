'use client';

import { useMemo, useState } from 'react';
import { createQuoteAction } from '@/app/ker-care/actions/provider';
import { CareForm } from '@/components/care/CareForm';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { computeQuote, QuoteValidationError } from '@/lib/care/quote';
import { formatXOF } from '@/lib/format';

interface Line {
  key: number;
  label: string;
  quantity: string;
  unitPrice: string;
}

const FEES = [
  { name: 'travelFee', label: 'Déplacement' },
  { name: 'diagnosticFee', label: 'Diagnostic' },
  { name: 'laborAmount', label: 'Main-d’œuvre' },
  { name: 'otherFees', label: 'Autres frais' },
  { name: 'discountAmount', label: 'Remise' },
  { name: 'taxAmount', label: 'Taxes (si applicables)' },
] as const;

type FeeName = (typeof FEES)[number]['name'];

const digits = (value: string) => Number.parseInt(value.replace(/\D/g, '') || '0', 10);

/**
 * Formulaire de devis : lignes de pièces dynamiques et total indicatif
 * calculé en direct. Le serveur recalcule intégralement le devis.
 */
export function QuoteForm({
  reference,
  csrfToken,
  defaultValidityDays,
  isSupplement,
}: {
  reference: string;
  csrfToken: string;
  defaultValidityDays: number;
  isSupplement: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([{ key: 1, label: '', quantity: '1', unitPrice: '' }]);
  const [fees, setFees] = useState<Record<FeeName, string>>({
    travelFee: '',
    diagnosticFee: '',
    laborAmount: '',
    otherFees: '',
    discountAmount: '',
    taxAmount: '',
  });

  const preview = useMemo(() => {
    try {
      const result = computeQuote({
        lines: lines
          .filter((line) => line.label.trim())
          .map((line) => ({
            label: line.label,
            quantity: Math.max(1, digits(line.quantity)),
            unitPrice: digits(line.unitPrice),
          })),
        travelFee: digits(fees.travelFee),
        diagnosticFee: digits(fees.diagnosticFee),
        laborAmount: digits(fees.laborAmount),
        otherFees: digits(fees.otherFees),
        discountAmount: digits(fees.discountAmount),
        taxAmount: digits(fees.taxAmount),
      });
      return { total: result.totalAmount, error: null as string | null };
    } catch (error) {
      return {
        total: null,
        error: error instanceof QuoteValidationError ? error.message : 'Montants invalides.',
      };
    }
  }, [lines, fees]);

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  return (
    <CareForm
      action={createQuoteAction}
      csrfToken={csrfToken}
      hidden={{ reference }}
      submitLabel={isSupplement ? 'Envoyer le supplément au client' : 'Envoyer le devis au client'}
      confirmMessage="Envoyer ce devis au client ? Il ne pourra plus être modifié, seulement remplacé par une nouvelle version."
      fullWidthSubmit
    >
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-forest-700">Pièces et fournitures</legend>
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 rounded-xl border border-sand-200 p-3 sm:grid-cols-[minmax(0,1fr)_90px_140px_auto]"
          >
            <TextField
              label={`Désignation ${index + 1}`}
              name="lineLabel"
              value={line.label}
              onChange={(event) => updateLine(line.key, { label: event.target.value })}
              maxLength={160}
              containerClassName="col-span-2 sm:col-span-1"
            />
            <TextField
              label="Qté"
              name="lineQuantity"
              inputMode="numeric"
              value={line.quantity}
              onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
            />
            <TextField
              label="Prix unitaire (FCFA)"
              name="lineUnitPrice"
              inputMode="numeric"
              value={line.unitPrice}
              onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
            />
            <div className="col-span-2 flex items-end sm:col-span-1">
              <button
                type="button"
                onClick={() =>
                  setLines((current) => current.filter((item) => item.key !== line.key))
                }
                className="min-h-[44px] rounded-xl border border-sand-300 px-3 text-sm font-semibold text-ink-soft hover:bg-sand-50"
                aria-label={`Retirer la ligne ${index + 1}`}
              >
                Retirer
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setLines((current) => [
              ...current,
              { key: (current.at(-1)?.key ?? 0) + 1, label: '', quantity: '1', unitPrice: '' },
            ])
          }
          className="min-h-[44px] rounded-xl border border-forest-200 px-4 text-sm font-semibold text-forest-700 hover:bg-sand-50"
        >
          Ajouter une ligne
        </button>
      </fieldset>

      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-bold text-forest-700">Frais (FCFA)</legend>
        {FEES.map((fee) => (
          <TextField
            key={fee.name}
            label={fee.label}
            name={fee.name}
            inputMode="numeric"
            value={fees[fee.name]}
            onChange={(event) =>
              setFees((current) => ({ ...current, [fee.name]: event.target.value }))
            }
            placeholder="0"
          />
        ))}
      </fieldset>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <TextField
          label="Validité (jours)"
          name="validityDays"
          type="number"
          min={1}
          max={90}
          defaultValue={defaultValidityDays}
          required
        />
      </div>
      <div className="mt-3 space-y-3">
        <TextAreaField label="Conditions" name="conditions" maxLength={2000} />
        <TextAreaField label="Exclusions" name="exclusions" maxLength={2000} />
        <TextAreaField label="Note au client" name="note" maxLength={2000} />
      </div>

      <div className="mt-4 rounded-xl bg-forest-50 px-4 py-3" aria-live="polite">
        <p className="text-sm text-forest-800">
          Total indicatif :{' '}
          <strong className="text-lg">
            {preview.total !== null ? formatXOF(preview.total) : '—'}
          </strong>
        </p>
        {preview.error ? <p className="text-sm text-ember-800">{preview.error}</p> : null}
        <p className="mt-1 text-xs text-ink-muted">
          Le total définitif est recalculé par Kerplus à l’envoi, à partir des lignes et des frais.
        </p>
      </div>
    </CareForm>
  );
}

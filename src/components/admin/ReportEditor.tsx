'use client';

import { useActionState, useMemo, useState } from 'react';
import { saveReportAction } from '@/app/admin/actions/reports';
import type { ActionState } from '@/app/admin/actions/shared';
import { CSRF_FIELD } from '@/lib/security/csrf-field';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { formatXOF } from '@/lib/format';

export interface ReportItemDraft {
  category: string;
  label: string;
  amount: number;
  percentage: number | null;
  description: string;
}

/**
 * Postes proposés par défaut. Les montants restent vides : ils doivent être
 * saisis et validés par Kerplus, jamais déduits automatiquement.
 */
const DEFAULT_CATEGORIES: { category: string; labels: string[] }[] = [
  {
    category: 'Gros œuvre',
    labels: ['Fondations', 'Élévation et structure', 'Dallage et planchers'],
  },
  { category: 'Couverture', labels: ['Toiture ou étanchéité'] },
  {
    category: 'Second œuvre',
    labels: ['Menuiserie', 'Électricité', 'Plomberie', 'Revêtements', 'Peinture'],
  },
  { category: 'Main-d’œuvre', labels: ['Main-d’œuvre et encadrement de chantier'] },
];

function emptyItem(category: string, label: string): ReportItemDraft {
  return { category, label, amount: 0, percentage: null, description: '' };
}

export function ReportEditor({
  orderId,
  csrfToken,
  initialItems,
  initialContent,
  estimationTotal,
  defaultExclusions,
  defaultAssumptions,
}: {
  orderId: string;
  csrfToken: string;
  initialItems: ReportItemDraft[];
  initialContent: {
    summary: string;
    assumptions: string;
    recommendations: string;
    exclusions: string;
    timeline: string;
    validatedBy: string;
  };
  estimationTotal: number | null;
  defaultExclusions: string;
  defaultAssumptions: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveReportAction, {});
  const [items, setItems] = useState<ReportItemDraft[]>(
    initialItems.length > 0
      ? initialItems
      : DEFAULT_CATEGORIES.flatMap((group) =>
          group.labels.map((label) => emptyItem(group.category, label)),
        ),
  );

  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0),
    [items],
  );

  const difference = estimationTotal === null ? null : total - estimationTotal;

  const updateItem = (index: number, patch: Partial<ReportItemDraft>) => {
    setItems((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name={CSRF_FIELD} value={csrfToken} />
      <input type="hidden" name="orderId" value={orderId} />

      {/* Postes */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold">Répartition par poste</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setItems((current) => [...current, emptyItem('', '')])}
          >
            + Ajouter un poste
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-sand-50 text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-2 py-2 font-semibold">Catégorie</th>
                <th className="px-2 py-2 font-semibold">Poste</th>
                <th className="px-2 py-2 font-semibold">Montant (FCFA)</th>
                <th className="px-2 py-2 font-semibold">Part (%)</th>
                <th className="px-2 py-2 font-semibold">Précisions</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`item-${index}`} className="border-t border-sand-200 align-top">
                  <td className="px-2 py-2">
                    <input
                      name="itemCategory"
                      value={item.category}
                      onChange={(event) => updateItem(index, { category: event.target.value })}
                      className="w-36 rounded-lg border border-sand-300 px-2 py-2"
                      aria-label={`Catégorie du poste ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      name="itemLabel"
                      value={item.label}
                      onChange={(event) => updateItem(index, { label: event.target.value })}
                      className="w-48 rounded-lg border border-sand-300 px-2 py-2"
                      aria-label={`Libellé du poste ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      name="itemAmount"
                      inputMode="numeric"
                      value={item.amount === 0 ? '' : String(item.amount)}
                      onChange={(event) =>
                        updateItem(index, {
                          amount: Number.parseInt(event.target.value.replace(/\D/g, ''), 10) || 0,
                        })
                      }
                      className="w-32 rounded-lg border border-sand-300 px-2 py-2 text-right"
                      aria-label={`Montant du poste ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      name="itemPercentage"
                      inputMode="decimal"
                      value={item.percentage === null ? '' : String(item.percentage / 100)}
                      onChange={(event) => {
                        const raw = event.target.value.replace(',', '.');
                        const parsed = raw === '' ? null : Math.round(Number(raw) * 100);
                        updateItem(index, {
                          percentage: parsed !== null && Number.isFinite(parsed) ? parsed : null,
                        });
                      }}
                      className="w-20 rounded-lg border border-sand-300 px-2 py-2 text-right"
                      aria-label={`Part du poste ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      name="itemDescription"
                      value={item.description}
                      onChange={(event) => updateItem(index, { description: event.target.value })}
                      className="w-full min-w-[180px] rounded-lg border border-sand-300 px-2 py-2"
                      aria-label={`Précisions du poste ${index + 1}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                      className="rounded-lg px-2 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                      aria-label={`Supprimer le poste ${index + 1}`}
                    >
                      Retirer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Contrôle de cohérence */}
        <div className="mt-3 rounded-xl bg-sand-50 p-4 text-sm">
          <p>
            <span className="text-ink-muted">Total des postes saisis : </span>
            <strong>{formatXOF(total)}</strong>
          </p>
          {estimationTotal !== null ? (
            <p className="mt-1">
              <span className="text-ink-muted">Estimation de référence : </span>
              <strong>{formatXOF(estimationTotal)}</strong>
              {difference !== null && difference !== 0 ? (
                <span
                  className={`ml-2 font-semibold ${Math.abs(difference) > estimationTotal * 0.05 ? 'text-red-700' : 'text-ember-700'}`}
                >
                  Écart : {difference > 0 ? '+' : ''}
                  {formatXOF(difference)}
                </span>
              ) : (
                <span className="ml-2 font-semibold text-emerald-700">Somme cohérente</span>
              )}
            </p>
          ) : null}
        </div>
      </div>

      {/* Textes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TextBlock
          name="summary"
          label="Synthèse"
          defaultValue={initialContent.summary}
          placeholder="Analyse générale du projet, points d’attention majeurs…"
        />
        <TextBlock
          name="assumptions"
          label="Hypothèses retenues"
          defaultValue={initialContent.assumptions || defaultAssumptions}
        />
        <TextBlock
          name="timeline"
          label="Délais estimatifs"
          defaultValue={initialContent.timeline}
          placeholder="Phasage prévisionnel du chantier…"
        />
        <TextBlock
          name="recommendations"
          label="Recommandations techniques"
          defaultValue={initialContent.recommendations}
        />
        <TextBlock
          name="exclusions"
          label="Exclusions"
          defaultValue={initialContent.exclusions || defaultExclusions}
          className="lg:col-span-2"
        />
      </div>

      <div className="max-w-md">
        <label htmlFor="validatedBy" className="text-sm font-semibold text-forest-700">
          Rapport validé par
        </label>
        <input
          id="validatedBy"
          name="validatedBy"
          defaultValue={initialContent.validatedBy}
          placeholder="Nom et fonction du valideur Kerplus"
          className="mt-1 w-full rounded-xl border border-sand-300 px-3 py-2.5"
        />
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <Button type="submit" size="lg" loading={pending}>
        Enregistrer le rapport
      </Button>
    </form>
  );
}

function TextBlock({
  name,
  label,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="text-sm font-semibold text-forest-700">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={5}
        maxLength={8000}
        className="mt-1 w-full rounded-xl border border-sand-300 p-3 text-sm focus:border-forest-500"
      />
    </div>
  );
}

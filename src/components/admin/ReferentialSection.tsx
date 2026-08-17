import { ActionForm, type AdminAction } from './ActionForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { formatDecimal } from '@/lib/format';
import { fromCoefficientInt } from '@/lib/estimation/constants';

export interface ReferentialRow {
  id: string;
  name: string;
  description?: string | null;
  /** Coefficient ×1000, pour les types de projets et les villes. */
  coefficient?: number;
  /** Prix au m² en FCFA, pour les niveaux de finition. */
  pricePerSquareMeter?: number;
  active: boolean;
  displayOrder: number;
  usageCount: number;
}

const INPUT = 'w-full rounded-lg border border-sand-300 px-2.5 py-2 text-sm';

/**
 * Section d'administration d'un référentiel (types de projets, villes,
 * finitions). Chaque ligne est un formulaire indépendant : une modification
 * n'affecte jamais les autres lignes ni les simulations déjà enregistrées.
 */
export function ReferentialSection({
  title,
  description,
  kind,
  rows,
  csrfToken,
  saveAction,
  deleteAction,
  valueLabel,
  valueKind,
  withDescription = false,
}: {
  title: string;
  description: string;
  kind: 'projectType' | 'cityZone' | 'finishLevel';
  rows: ReferentialRow[];
  csrfToken: string;
  saveAction: AdminAction;
  deleteAction: AdminAction;
  valueLabel: string;
  valueKind: 'coefficient' | 'price';
  withDescription?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-sand-200 bg-sand-50 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <ActionForm
                action={saveAction}
                csrfToken={csrfToken}
                hidden={{ id: row.id }}
                submitLabel="Enregistrer"
                variant="ghost"
                size="sm"
                className="flex flex-1 flex-wrap items-end gap-3 [&>div]:mt-0"
              >
                <label className="flex flex-col gap-1 text-xs font-semibold text-forest-700">
                  Nom
                  <input name="name" defaultValue={row.name} className={`${INPUT} w-44`} required />
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold text-forest-700">
                  {valueLabel}
                  {valueKind === 'coefficient' ? (
                    <input
                      name="coefficient"
                      inputMode="decimal"
                      defaultValue={formatDecimal(fromCoefficientInt(row.coefficient ?? 1000))}
                      className={`${INPUT} w-24 text-right`}
                      required
                    />
                  ) : (
                    <input
                      name="pricePerSquareMeter"
                      inputMode="numeric"
                      defaultValue={String(row.pricePerSquareMeter ?? 0)}
                      className={`${INPUT} w-28 text-right`}
                      required
                    />
                  )}
                </label>

                {withDescription ? (
                  <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-semibold text-forest-700">
                    Description
                    <input
                      name="description"
                      defaultValue={row.description ?? ''}
                      className={INPUT}
                    />
                  </label>
                ) : null}

                <label className="flex flex-col gap-1 text-xs font-semibold text-forest-700">
                  Ordre
                  <input
                    name="displayOrder"
                    inputMode="numeric"
                    defaultValue={String(row.displayOrder)}
                    className={`${INPUT} w-16 text-right`}
                  />
                </label>

                <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-forest-700">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={row.active}
                    className="h-4 w-4 accent-forest-600"
                  />
                  Actif
                </label>
              </ActionForm>

              <ActionForm
                action={deleteAction}
                csrfToken={csrfToken}
                hidden={{ id: row.id, kind }}
                submitLabel={row.usageCount > 0 ? 'Désactiver' : 'Supprimer'}
                variant="danger"
                size="sm"
                confirmMessage={
                  row.usageCount > 0
                    ? `Cet élément est utilisé par ${row.usageCount} simulation(s) : il sera désactivé et non supprimé. Continuer ?`
                    : 'Supprimer définitivement cet élément ?'
                }
                className="[&>div]:mt-0"
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Utilisé par {row.usageCount} simulation(s).
              {row.usageCount > 0 ? ' La suppression est bloquée pour préserver l’historique.' : ''}
            </p>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-forest-300 p-3">
          <p className="mb-2 text-sm font-bold text-forest-700">Ajouter</p>
          <ActionForm
            action={saveAction}
            csrfToken={csrfToken}
            submitLabel="Créer"
            size="sm"
            className="flex flex-wrap items-end gap-3 [&>div]:mt-0"
          >
            <label className="flex flex-col gap-1 text-xs font-semibold text-forest-700">
              Nom
              <input name="name" className={`${INPUT} w-44`} required />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-forest-700">
              {valueLabel}
              {valueKind === 'coefficient' ? (
                <input
                  name="coefficient"
                  inputMode="decimal"
                  defaultValue="1,00"
                  className={`${INPUT} w-24 text-right`}
                  required
                />
              ) : (
                <input
                  name="pricePerSquareMeter"
                  inputMode="numeric"
                  defaultValue="200000"
                  className={`${INPUT} w-28 text-right`}
                  required
                />
              )}
            </label>
            {withDescription ? (
              <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-semibold text-forest-700">
                Description
                <input name="description" className={INPUT} />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-xs font-semibold text-forest-700">
              Ordre
              <input
                name="displayOrder"
                inputMode="numeric"
                defaultValue="99"
                className={`${INPUT} w-16 text-right`}
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-forest-700">
              <input
                type="checkbox"
                name="active"
                defaultChecked
                className="h-4 w-4 accent-forest-600"
              />
              Actif
            </label>
          </ActionForm>
        </div>
      </CardBody>
    </Card>
  );
}

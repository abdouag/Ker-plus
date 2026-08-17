import { Alert } from '@/components/ui/Feedback';

export function DisclaimerPanel({
  disclaimer,
  assumptions,
  exclusions,
  variationFactors,
}: {
  disclaimer: string;
  assumptions: string;
  exclusions: string[];
  variationFactors: string[];
}) {
  return (
    <div className="space-y-5">
      <Alert tone="warning" title="Estimation indicative" role="status">
        {disclaimer}
      </Alert>

      <div>
        <h3 className="text-base font-bold text-forest-700">Hypothèses de calcul</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{assumptions}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="text-base font-bold text-forest-700">Le montant peut varier selon</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {variationFactors.map((factor) => (
              <li key={factor} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember-400"
                />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-base font-bold text-forest-700">Postes exclus de l’estimation</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {exclusions.map((exclusion) => (
              <li key={exclusion} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sand-400"
                />
                <span>{exclusion}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-semibold text-forest-700">
            Le prix du terrain n’est jamais inclus dans le calcul.
          </p>
        </div>
      </div>
    </div>
  );
}

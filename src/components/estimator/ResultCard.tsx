import { formatDateTime, formatSurface, formatXOF } from '@/lib/format';
import type { EstimationResult } from '@/lib/estimation/calculator';

export interface ResultSummary {
  projectTypeName: string;
  cityName: string;
  finishName: string;
  surface: number;
  createdAt: Date;
  reference: string | null;
}

export function ResultCard({
  result,
  summary,
}: {
  result: EstimationResult;
  summary: ResultSummary;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-forest-600 text-white shadow-raised">
      <div className="px-5 py-6 sm:px-7 sm:py-7">
        <p className="text-sm font-medium uppercase tracking-wide text-forest-100">
          Estimation indicative
        </p>
        <p
          className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl"
          aria-live="polite"
          data-testid="estimation-total"
        >
          {formatXOF(result.estimatedTotal)}
        </p>
        <p className="mt-3 text-sm text-forest-100 sm:text-base" data-testid="estimation-range">
          Fourchette prévisionnelle : {formatXOF(result.estimatedMinimum, { withCurrency: false })}{' '}
          à {formatXOF(result.estimatedMaximum)}
        </p>
      </div>

      <dl
        className="grid grid-cols-2 gap-px bg-forest-500 text-sm sm:grid-cols-3"
        data-testid="estimation-summary"
      >
        <SummaryCell label="Type de projet" value={summary.projectTypeName} />
        <SummaryCell label="Surface totale" value={formatSurface(summary.surface)} />
        <SummaryCell label="Ville / zone" value={summary.cityName} />
        <SummaryCell label="Niveau de finition" value={summary.finishName} />
        <SummaryCell label="Date de l’estimation" value={formatDateTime(summary.createdAt)} />
        <SummaryCell label="Référence" value={summary.reference ?? 'Enregistrement…'} />
      </dl>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-forest-600 px-4 py-3">
      <dt className="text-xs text-forest-100">{label}</dt>
      <dd className="mt-0.5 font-semibold text-white">{value}</dd>
    </div>
  );
}

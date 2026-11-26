import type { Quote, QuoteLine } from '@prisma/client';
import { formatDate, formatXOF } from '@/lib/format';
import { QuoteStatusBadge } from './StatusBadge';

/**
 * Affichage en lecture seule d'une version de devis. Les montants affichés
 * proviennent exclusivement de la base (calculés côté serveur).
 */
export function QuoteDetails({ quote }: { quote: Quote & { lines: QuoteLine[] } }) {
  const fees = [
    { label: 'Déplacement', value: quote.travelFee },
    { label: 'Diagnostic', value: quote.diagnosticFee },
    { label: 'Main-d’œuvre', value: quote.laborAmount },
    { label: 'Pièces et fournitures', value: quote.partsAmount },
    { label: 'Autres frais', value: quote.otherFees },
  ].filter((fee) => fee.value > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-forest-700">
          Devis {quote.reference} · version {quote.version}
        </p>
        <QuoteStatusBadge status={quote.status} />
      </div>

      {quote.lines.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Détail des pièces et fournitures</caption>
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase text-ink-muted">
                <th scope="col" className="py-2 pr-2 font-semibold">
                  Désignation
                </th>
                <th scope="col" className="py-2 pr-2 text-right font-semibold">
                  Qté
                </th>
                <th scope="col" className="py-2 pr-2 text-right font-semibold">
                  Prix unitaire
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((line) => (
                <tr key={line.id} className="border-b border-sand-100">
                  <td className="py-2 pr-2">{line.label}</td>
                  <td className="py-2 pr-2 text-right">{line.quantity}</td>
                  <td className="py-2 pr-2 text-right">{formatXOF(line.unitPrice)}</td>
                  <td className="py-2 text-right">{formatXOF(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <dl className="space-y-1 text-sm">
        {fees.map((fee) => (
          <div key={fee.label} className="flex justify-between gap-4">
            <dt className="text-ink-soft">{fee.label}</dt>
            <dd>{formatXOF(fee.value)}</dd>
          </div>
        ))}
        {quote.discountAmount > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Remise</dt>
            <dd>-{formatXOF(quote.discountAmount)}</dd>
          </div>
        ) : null}
        {quote.taxAmount > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Taxes</dt>
            <dd>{formatXOF(quote.taxAmount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 border-t border-sand-200 pt-2 text-base font-extrabold text-forest-700">
          <dt>Total</dt>
          <dd>{formatXOF(quote.totalAmount)}</dd>
        </div>
      </dl>

      <p className="text-xs text-ink-muted">Valable jusqu’au {formatDate(quote.validUntil)}.</p>
      {quote.conditions ? (
        <p className="text-sm text-ink-soft">
          <span className="font-semibold">Conditions : </span>
          {quote.conditions}
        </p>
      ) : null}
      {quote.exclusions ? (
        <p className="text-sm text-ink-soft">
          <span className="font-semibold">Exclusions : </span>
          {quote.exclusions}
        </p>
      ) : null}
      {quote.note ? <p className="text-sm text-ink-soft">{quote.note}</p> : null}
      {quote.status === 'REFUSED' && quote.refusalReason ? (
        <p className="text-sm text-red-800">Motif du refus : {quote.refusalReason}</p>
      ) : null}
    </div>
  );
}

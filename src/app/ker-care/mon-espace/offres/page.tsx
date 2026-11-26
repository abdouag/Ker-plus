import type { Metadata } from 'next';
import { Badge, EmptyState, Alert } from '@/components/ui/Feedback';
import { IconCheck } from '@/components/ui/icons';
import { requireClientPage } from '@/lib/auth/account-guard';
import { listActivePlans } from '@/lib/care/services/client-queries';
import { formatXOF } from '@/lib/format';

export const metadata: Metadata = { title: 'Offres' };
export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  await requireClientPage('/ker-care/mon-espace/offres');
  const plans = await listActivePlans();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-700">Offres Kër Care</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Vous utilisez actuellement Kër Care gratuitement : carnet, rappels dans votre espace et
          demandes d’intervention facturées sur devis.
        </p>
      </div>

      <Alert tone="warning" title="Offres indicatives — bientôt disponibles">
        Ces formules sont en préparation et ne peuvent pas encore être souscrites. Leurs prix et
        avantages sont des hypothèses susceptibles d’évoluer. Aucune formule ne comprend
        d’interventions illimitées : les pièces, les travaux lourds et les prestations hors formule
        restent facturés séparément, sur devis. Aucun débit ni renouvellement automatique ne sera
        mis en place sans votre accord explicite.
      </Alert>

      {plans.length === 0 ? (
        <EmptyState title="Aucune offre publiée pour le moment" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-col rounded-2xl border border-sand-200 bg-white p-5 shadow-card"
            >
              <Badge tone="warning" className="self-start">
                {plan.subscribable ? 'Disponible prochainement' : 'Offre indicative'}
              </Badge>
              <h2 className="mt-3 text-lg font-extrabold text-forest-700">{plan.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                <span className="text-xl font-extrabold text-forest-700">
                  {plan.monthlyPrice === 0 ? 'Gratuit' : formatXOF(plan.monthlyPrice)}
                </span>
                {plan.monthlyPrice > 0 ? ' / mois (indicatif)' : null}
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink-soft">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-xl bg-sand-50 px-3 py-2 text-xs text-ink-muted">
                Souscription non disponible pour le moment.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { LinkButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Feedback';
import {
  IconCheck,
  IconClock,
  IconFileText,
  IconHome,
  IconShield,
  IconWrench,
} from '@/components/ui/icons';
import { formatXOF } from '@/lib/format';
import { getSettingString, SETTING_KEYS } from '@/lib/settings';
import { listActiveCategories, listActivePlans } from '@/lib/care/services/client-queries';

export const metadata: Metadata = {
  title: 'Kër Care — entretien et dépannage de votre maison au Sénégal',
  description:
    'Carnet numérique du logement, rappels d’entretien et interventions par des prestataires vérifiés par Kerplus : plomberie, électricité, climatisation, pompe, solaire…',
  alternates: { canonical: '/ker-care' },
};

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    title: 'Ajoutez votre maison',
    text: 'Quelques informations suffisent : commune, quartier, repère. Ajoutez ensuite vos équipements (climatiseurs, pompe, chauffe-eau…).',
  },
  {
    title: 'Signalez un besoin',
    text: 'Décrivez le problème, joignez des photos si vous le souhaitez et indiquez vos disponibilités.',
  },
  {
    title: 'Validez avant toute intervention',
    text: 'Kerplus sollicite un prestataire vérifié. Vous acceptez le devis et le créneau avant qu’il ne se déplace.',
  },
];

const NOTEBOOK_BENEFITS = [
  {
    icon: IconHome,
    title: 'Toute la mémoire de votre maison',
    text: 'Fiche du logement, équipements, garanties, plans et factures réunis au même endroit.',
  },
  {
    icon: IconClock,
    title: 'Des rappels avant la panne',
    text: 'Les échéances d’entretien sont calculées pour chaque équipement et restent modifiables.',
  },
  {
    icon: IconFileText,
    title: 'Un historique complet',
    text: 'Chaque intervention clôturée rejoint le carnet : devis accepté, rapport, photos avant/après.',
  },
  {
    icon: IconShield,
    title: 'Vos documents restent privés',
    text: 'Seuls vous et l’équipe Kerplus y avez accès ; le prestataire ne voit que ce qui est utile à sa mission.',
  },
];

export default async function KerCarePage() {
  const [categories, plans, zone] = await Promise.all([
    listActiveCategories(),
    listActivePlans(),
    getSettingString(SETTING_KEYS.CARE_ZONE_TEXT, 'Dakar et sa banlieue'),
  ]);

  const faq = [
    {
      q: 'Kër Care est-il un service d’urgence ?',
      a: 'Non. Kër Care n’est pas un service de secours. En cas d’odeur de gaz, de fumée, d’incendie, de risque d’électrocution ou d’effondrement, mettez-vous en sécurité et appelez immédiatement les secours. Les consignes et numéros d’urgence s’affichent dès que vous signalez un danger immédiat. Vous pourrez ensuite nous signaler la réparation à prévoir.',
    },
    {
      q: 'Quelle zone est desservie ?',
      a: `Kër Care démarre à ${zone}. La couverture s’étendra progressivement au reste du Sénégal. Si votre commune n’est pas encore couverte, votre demande vous sera signalée comme telle.`,
    },
    {
      q: 'Combien coûte une intervention ?',
      a: 'Les prix affichés par catégorie sont indicatifs. Le prix définitif est celui du devis détaillé que vous acceptez dans votre espace. Aucun travail n’est engagé sans votre accord, et tout supplément doit être approuvé de nouveau.',
    },
    {
      q: 'Qui sont les prestataires ?',
      a: 'Des artisans et techniciens dont Kerplus a vérifié l’identité, le téléphone et les compétences. Un prestataire n’est proposé qu’après cette vérification. Vous voyez son nom avant le rendez-vous.',
    },
    {
      q: 'Les délais d’intervention sont-ils garantis ?',
      a: 'Non. Le créneau n’est définitif qu’une fois proposé par le prestataire et confirmé par vous. Nous ne promettons pas de délai tant qu’il n’est pas confirmé.',
    },
    {
      q: 'Peut-on payer en ligne ?',
      a: 'Pas encore. Le paiement en ligne n’est pas disponible pour Kër Care : les modalités de règlement vous sont communiquées avec le devis. Aucun paiement n’est demandé lors de la création d’une demande.',
    },
    {
      q: 'Les abonnements sont-ils disponibles ?',
      a: 'Pas encore. Les formules présentées sont des offres indicatives en préparation. Elles ne peuvent pas être souscrites pour l’instant et l’utilisation du carnet reste gratuite.',
    },
    {
      q: 'Que deviennent mes données et mes photos ?',
      a: 'Elles servent uniquement à gérer votre logement et vos demandes. Les fichiers sont stockés de façon privée. L’adresse précise et votre téléphone ne sont communiqués au prestataire qu’une fois la mission acceptée.',
    },
    {
      q: 'Et si l’intervention ne me convient pas ?',
      a: 'À la fin de l’intervention, le prestataire dépose un rapport. Vous pouvez valider l’intervention ou la contester : Kerplus examine alors la situation avec vous et le prestataire.',
    },
    {
      q: 'J’ai fait construire avec Kerplus, puis-je relier mon projet ?',
      a: 'Oui. Depuis la fiche de votre maison, rattachez votre référence de commande Kerplus (KP-CMD-…) pour la retrouver dans le carnet.',
    },
  ];

  return (
    <>
      <SiteHeader />
      <main id="contenu">
        {/* Accroche */}
        <section className="relative overflow-hidden bg-forest-600 text-white">
          <div aria-hidden="true" className="kp-blueprint-grid absolute inset-0" />
          <div className="relative mx-auto max-w-content px-4 py-12 sm:px-6 sm:py-16">
            <p className="kp-fade-up text-sm font-semibold uppercase tracking-wide text-ember-200">
              Kër Care — entretien et dépannage
            </p>
            <h1 className="kp-fade-up mt-3 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl [animation-delay:80ms]">
              Prenez soin de votre maison, sans attendre la panne.
            </h1>
            <p className="kp-fade-up mt-4 max-w-2xl text-base leading-relaxed text-forest-100 sm:text-lg [animation-delay:160ms]">
              Un carnet numérique pour votre logement, des rappels d’entretien et des interventions
              coordonnées par Kerplus avec des prestataires vérifiés. Zone desservie : {zone}.
            </p>
            <div className="kp-fade-up mt-7 flex flex-col gap-3 sm:flex-row [animation-delay:240ms]">
              <LinkButton href="/ker-care/mon-espace/maisons/nouvelle" size="lg">
                Ajouter ma maison
              </LinkButton>
              <LinkButton href="/ker-care/mon-espace/demandes/nouvelle" size="lg" variant="ghost">
                Demander une intervention
              </LinkButton>
            </div>
            <p className="mt-4 text-sm text-forest-100">
              Déjà client ?{' '}
              <Link
                href="/ker-care/mon-espace/demandes"
                className="font-semibold text-white underline"
              >
                Accéder à mes demandes
              </Link>
            </p>
          </div>
        </section>

        {/* Catégories */}
        <section
          aria-labelledby="categories-titre"
          className="mx-auto max-w-content px-4 py-14 sm:px-6"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">Services</p>
          <h2 id="categories-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Les interventions prises en charge
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Les montants « à partir de » sont indicatifs : le prix définitif est celui du devis que
            vous acceptez.
          </p>
          {categories.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">
              Le catalogue des services est en cours de préparation.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="rounded-2xl border border-sand-200 bg-white p-5 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                      <IconWrench width={20} height={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-forest-700">{category.name}</h3>
                      {category.description ? (
                        <p className="mt-1 text-sm text-ink-soft">{category.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {category.services.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {category.services.map((service) => (
                        <li key={service}>
                          <Badge tone="neutral">{service}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {category.indicativePriceFrom ? (
                    <p className="mt-3 text-sm text-ink-soft">
                      À partir de{' '}
                      <span className="font-semibold text-forest-700">
                        {formatXOF(category.indicativePriceFrom)}
                      </span>{' '}
                      — indicatif
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Fonctionnement */}
        <section aria-labelledby="etapes-titre" className="border-y border-sand-200 bg-sand-50">
          <div className="mx-auto max-w-content px-4 py-14 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
              Comment ça marche
            </p>
            <h2 id="etapes-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Trois étapes, aucune surprise
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-sand-200 bg-white p-5 shadow-card"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ember-400 text-base font-extrabold text-forest-800">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-forest-700">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Carnet */}
        <section
          aria-labelledby="carnet-titre"
          className="mx-auto max-w-content px-4 py-14 sm:px-6"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
            Le carnet numérique
          </p>
          <h2 id="carnet-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
            La mémoire de votre logement, enfin à jour
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NOTEBOOK_BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-2xl border border-sand-200 bg-white p-5 shadow-card"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                  <benefit.icon width={22} height={22} />
                </span>
                <h3 className="mt-3 text-base font-bold text-forest-700">{benefit.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{benefit.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Offres indicatives */}
        {plans.length > 0 ? (
          <section aria-labelledby="offres-titre" className="border-y border-sand-200 bg-sand-50">
            <div className="mx-auto max-w-content px-4 py-14 sm:px-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
                Formules
              </p>
              <h2 id="offres-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
                Des formules en préparation
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-soft">
                Offres indicatives, non souscriptibles pour le moment. Aucune intervention illimitée
                : les pièces, les travaux lourds et les prestations hors formule restent facturés
                séparément sur devis.
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {plans.map((plan) => (
                  <li
                    key={plan.id}
                    className="flex flex-col rounded-2xl border border-sand-200 bg-white p-5 shadow-card"
                  >
                    <Badge tone="warning" className="self-start">
                      Offre indicative — bientôt disponible
                    </Badge>
                    <h3 className="mt-3 text-lg font-extrabold text-forest-700">{plan.name}</h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      <span className="text-xl font-extrabold text-forest-700">
                        {plan.monthlyPrice === 0 ? 'Gratuit' : formatXOF(plan.monthlyPrice)}
                      </span>
                      {plan.monthlyPrice > 0 ? ' / mois (indicatif)' : null}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                      {plan.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2">
                          <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* FAQ */}
        <section aria-labelledby="faq-titre" className="mx-auto max-w-content px-4 py-14 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
            Questions fréquentes
          </p>
          <h2 id="faq-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Ce qu’il faut savoir avant de commencer
          </h2>
          <div className="mt-8 divide-y divide-sand-200 rounded-2xl border border-sand-200 bg-white shadow-card">
            {faq.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-forest-700">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="text-xl leading-none text-ember-500 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Appel final */}
        <section className="relative overflow-hidden bg-forest-600">
          <div aria-hidden="true" className="kp-blueprint-grid absolute inset-0" />
          <div className="relative mx-auto flex max-w-content flex-col gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Commencez par votre maison</h2>
              <p className="mt-2 text-forest-100">
                Création de compte gratuite. Le carnet reste à vous, même sans intervention.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/ker-care/mon-espace/maisons/nouvelle">
                Ajouter ma maison
              </LinkButton>
              <LinkButton href="/compte/connexion" variant="ghost">
                Se connecter
              </LinkButton>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

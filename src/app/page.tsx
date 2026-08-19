import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ConsentBanner } from '@/components/layout/ConsentBanner';
import { EstimatorApp } from '@/components/estimator/EstimatorApp';
import { RealisationsSection } from '@/components/home/RealisationsSection';
import { ServicesSection } from '@/components/home/ServicesSection';
import { LinkButton } from '@/components/ui/Button';
import { IconBolt, IconEye, IconFileText, IconPhone } from '@/components/ui/icons';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Feedback';
import { getActiveReferentials } from '@/lib/services/estimation';
import {
  getPremiumReportPrice,
  getReportDeliveryHours,
  getSettingBool,
  getSettingInt,
  getSettingList,
  getSettingString,
  SETTING_KEYS,
} from '@/lib/settings';
import { formatXOF } from '@/lib/format';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Estimation du coût de construction au Sénégal — Estimateur Kerplus',
  description:
    'Calculez en moins de 2 minutes le prix de construction de votre maison, villa duplex ou immeuble à Dakar, Thiès, Mbour, Saly ou en région. Rapport technique détaillé sous 48 h.',
  alternates: { canonical: '/' },
};

export const dynamic = 'force-dynamic';

const ADVANTAGES = [
  {
    icon: IconBolt,
    title: 'Estimation immédiate',
    text: 'Le budget indicatif s’affiche pendant que vous décrivez votre projet, sans inscription ni attente.',
  },
  {
    icon: IconEye,
    title: 'Hypothèses transparentes',
    text: 'Les hypothèses de calcul, les postes exclus et les facteurs de variation sont affichés clairement.',
  },
  {
    icon: IconFileText,
    title: 'Rapport préparé par notre équipe',
    text: 'Chaque rapport détaillé est préparé et validé par Kerplus : rien n’est généré automatiquement.',
  },
  {
    icon: IconPhone,
    title: 'Un échange pour décider',
    text: 'Un appel conseil accompagne chaque rapport afin d’en commenter les conclusions avec vous.',
  },
];

const STEPS = [
  {
    title: 'Décrivez votre projet',
    text: 'Type de construction, surface totale, ville et niveau de finition : quatre informations suffisent.',
  },
  {
    title: 'Obtenez votre estimation',
    text: 'Le budget indicatif et sa fourchette s’affichent immédiatement, avec les hypothèses retenues.',
  },
  {
    title: 'Commandez le rapport détaillé',
    text: 'Nos équipes préparent un rapport technique par poste, livré en PDF, suivi d’un appel conseil.',
  },
];

export default async function HomePage() {
  const [
    referentials,
    price,
    deliveryHours,
    callDuration,
    disclaimer,
    assumptions,
    exclusions,
    factors,
    orderEnabled,
  ] = await Promise.all([
    getActiveReferentials(),
    getPremiumReportPrice(),
    getReportDeliveryHours(),
    getSettingInt(SETTING_KEYS.CALL_DURATION_MINUTES, 20),
    getSettingString(SETTING_KEYS.DISCLAIMER_TEXT),
    getSettingString(SETTING_KEYS.ASSUMPTIONS_TEXT),
    getSettingList(SETTING_KEYS.EXCLUSIONS),
    getSettingList(SETTING_KEYS.VARIATION_FACTORS),
    getSettingBool(SETTING_KEYS.ORDER_ENABLED, true),
  ]);

  const estimatorEnabled = await getSettingBool(SETTING_KEYS.ESTIMATOR_ENABLED, true);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Estimateur Kerplus',
        url: env.siteUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        inLanguage: 'fr',
        description:
          'Estimation indicative du coût de construction au Sénégal : maison individuelle, villa duplex, immeuble R+1 à R+3.',
        offers: {
          '@type': 'Offer',
          name: 'Rapport technique détaillé',
          price: String(price),
          priceCurrency: 'XOF',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Comment est calculé le coût de construction au m² au Sénégal ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Le calcul applique un prix moyen au m² construit, ajusté par un coefficient de localisation (Dakar, Thiès, Mbour, Saly, Saint-Louis, Kaolack, Tambacounda, autres régions) et un coefficient lié au type de projet.',
            },
          },
          {
            '@type': 'Question',
            name: 'Le prix du terrain est-il inclus dans l’estimation ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Non. Le terrain, les études de sol, les honoraires professionnels, les raccordements et les taxes sont exclus de l’estimation.',
            },
          },
          {
            '@type': 'Question',
            name: 'L’estimation vaut-elle devis ?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Non. Il s’agit d’une estimation indicative. Elle ne constitue ni un devis contractuel ni une étude technique.',
            },
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Contenu généré côté serveur à partir de valeurs maîtrisées.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <main id="contenu">
        {/* Bandeau d'accroche */}
        <section className="bg-forest-600 text-white">
          <div className="mx-auto max-w-content px-4 py-10 sm:px-6 sm:py-14">
            <p className="text-sm font-semibold uppercase tracking-wide text-ember-200">
              Kerplus.sn — construction au Sénégal
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
              Construisez votre maison avec une vision claire dès le départ.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-forest-100 sm:text-lg">
              Kerplus vous accompagne dans la préparation, l’estimation et le suivi de votre projet
              de construction au Sénégal, simplement et en toute transparence.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="#estimateur" size="lg">
                Estimer mon projet
              </LinkButton>
              <LinkButton
                href="#methode"
                size="lg"
                className="border border-forest-400 bg-forest-700/40 text-white hover:bg-forest-700/70 active:bg-forest-700"
              >
                Découvrir Kerplus
              </LinkButton>
            </div>
            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ['Estimation immédiate', 'Résultat instantané, sans inscription'],
                ['Rapport détaillé', `Livré sous ${deliveryHours} h après paiement`],
                ['Appel conseil', `${callDuration} minutes avec un professionnel`],
              ].map(([term, description]) => (
                <div key={term} className="rounded-xl bg-forest-700/60 px-4 py-3">
                  <dt className="text-sm font-bold text-white">{term}</dt>
                  <dd className="mt-0.5 text-sm text-forest-100">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Estimateur */}
        <section id="estimateur" className="mx-auto max-w-content px-4 py-10 sm:px-6 sm:py-12">
          {!estimatorEnabled ? (
            <Alert tone="warning" title="Estimateur momentanément indisponible">
              Notre estimateur est en cours de mise à jour. Contactez Kerplus pour obtenir une
              estimation, nous reprenons le service très prochainement.
            </Alert>
          ) : (
            <EstimatorApp
              referentials={{
                projectTypes: referentials.projectTypes.map((type) => ({
                  id: type.id,
                  name: type.name,
                  description: type.description,
                  coefficient: type.coefficient,
                })),
                cityZones: referentials.cityZones.map((zone) => ({
                  id: zone.id,
                  name: zone.name,
                  coefficient: zone.coefficient,
                })),
                finishLevels: referentials.finishLevels.map((level) => ({
                  id: level.id,
                  name: level.name,
                  slug: level.slug,
                  description: level.description,
                  pricePerSquareMeter: level.pricePerSquareMeter,
                })),
                rangePercentage: referentials.rangePercentage,
              }}
              texts={{
                disclaimer,
                assumptions,
                exclusions,
                variationFactors: factors,
                reportPrice: price,
                deliveryHours,
                callDurationMinutes: callDuration,
                orderEnabled,
              }}
            />
          )}
        </section>

        {/* Méthode */}
        <section
          id="methode"
          aria-labelledby="methode-titre"
          className="mx-auto max-w-content px-4 py-14 sm:px-6"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
            Comment ça marche
          </p>
          <h2 id="methode-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Trois étapes, une vision claire
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardBody>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ember-400 font-bold text-forest-800">
                      {index + 1}
                    </span>
                    <h3 className="mt-3 text-base font-bold">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.text}</p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* Services */}
        <ServicesSection />

        {/* Avantages */}
        <section
          aria-labelledby="avantages-titre"
          className="border-y border-sand-200 bg-sand-50"
        >
          <div className="mx-auto max-w-content px-4 py-14 sm:px-6 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
              Pourquoi Kerplus
            </p>
            <h2 id="avantages-titre" className="mt-2 max-w-2xl text-2xl font-extrabold sm:text-3xl">
              Décidez sur des bases claires, pas sur des impressions
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ADVANTAGES.map((advantage) => (
                <li
                  key={advantage.title}
                  className="rounded-2xl border border-sand-200 bg-white p-5 shadow-card"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                    <advantage.icon width={22} height={22} />
                  </span>
                  <h3 className="mt-3 text-base font-bold text-forest-700">{advantage.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{advantage.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Réalisations */}
        <RealisationsSection />

        {/* Rapport détaillé */}
        <section id="rapport" className="mx-auto max-w-content px-4 py-14 sm:px-6">
          <Card>
            <CardBody className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px] md:items-center">
              <div>
                <h2 className="text-2xl font-extrabold sm:text-3xl">
                  Le rapport technique détaillé Kerplus
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-base">
                  Chaque rapport est préparé et validé par notre équipe à partir de votre projet. Il
                  reprend vos informations, les hypothèses retenues et la répartition budgétaire
                  poste par poste.
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {[
                    'Fondations et gros œuvre',
                    'Toiture ou étanchéité',
                    'Menuiserie intérieure et extérieure',
                    'Électricité et plomberie',
                    'Revêtements et peinture',
                    'Main-d’œuvre et délais',
                    'Recommandations techniques',
                    'Exclusions et avertissements',
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-ink-soft">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-500"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-sand-100 p-5 text-center">
                <p className="text-sm font-semibold text-ink-soft">Rapport technique détaillé</p>
                <p className="mt-1 text-3xl font-extrabold text-forest-700">{formatXOF(price)}</p>
                <p className="mt-2 text-sm text-ink-muted">
                  PDF livré sous {deliveryHours} h après confirmation du paiement, appel conseil de{' '}
                  {callDuration} minutes inclus.
                </p>
                <a
                  href="#estimateur"
                  className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ember-400 px-5 font-bold text-forest-800 hover:bg-ember-300"
                >
                  Commencer mon estimation
                </a>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Appel à l'action final */}
        <section aria-labelledby="cta-final-titre" className="bg-forest-600">
          <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-4 py-14 sm:px-6 sm:py-16 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 id="cta-final-titre" className="text-2xl font-extrabold text-white sm:text-3xl">
                Votre projet mérite un budget posé sur des bases sérieuses.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-forest-100">
                Commencez par une estimation gratuite : deux minutes suffisent pour cadrer votre
                projet et décider de la suite.
              </p>
            </div>
            <LinkButton href="#estimateur" size="lg" className="shrink-0">
              Estimer mon projet
            </LinkButton>
          </div>
        </section>

        {/* Contenu indexable */}
        <section className="mx-auto max-w-content px-4 pb-16 sm:px-6">
          <div className="kp-prose max-w-3xl">
            <h2>Prix de construction au m² au Sénégal</h2>
            <p>
              Le coût de construction d’une maison à Dakar diffère sensiblement de celui d’un projet
              à Thiès, Mbour, Saly, Saint-Louis, Kaolack ou Tambacounda. L’estimateur Kerplus
              applique un prix moyen au mètre carré construit, ajusté par un coefficient de
              localisation et un coefficient propre au type de projet : maison individuelle, villa
              duplex ou immeuble R+1 à R+3.
            </p>
            <h3>Ce que couvre l’estimation</h3>
            <p>
              L’estimation porte sur la construction du bâtiment : fondations, gros œuvre, toiture
              ou étanchéité, menuiserie, électricité, plomberie, revêtements, peinture et
              main-d’œuvre, selon le niveau de finition choisi.
            </p>
            <h3>Ce que l’estimation ne couvre pas</h3>
            <p>
              Le terrain n’est jamais inclus. Les études de sol, les honoraires professionnels, les
              raccordements aux réseaux, les taxes, autorisations et aménagements extérieurs sont
              également exclus. Pour un chiffrage engageant, un devis d’entreprise établi sur plans
              définitifs reste indispensable.
            </p>
            <h3>Estimation, devis ou étude technique ?</h3>
            <p>
              Une estimation donne un ordre de grandeur pour cadrer un budget. Un devis engage une
              entreprise sur un prix. Une étude technique valide la faisabilité structurelle du
              projet. L’estimateur Kerplus relève de la première catégorie ; le rapport détaillé
              apporte une décomposition budgétaire préparée par notre équipe.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
      <ConsentBanner />
    </>
  );
}

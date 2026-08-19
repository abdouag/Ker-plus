import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { LinkButton } from '@/components/ui/Button';
import { IconCheck, IconFileText } from '@/components/ui/icons';
import { SERVICE_ICONS } from '@/components/services/service-icons';
import { listPublicServices } from '@/lib/content/services';

export const metadata: Metadata = {
  title: 'Nos services — conception, études techniques et suivi de chantier',
  description:
    'Conception architecturale, étude béton armé, lots techniques, visualisation 3D, assistance technique et suivi de chantier : Kerplus accompagne votre projet de construction au Sénégal à chaque étape.',
  alternates: { canonical: '/services' },
};

/**
 * Page détaillée des services. Une page unique avec une fiche complète par
 * service (ancrée sur son slug) : chaque fiche porte l'objectif, les
 * prestations, les étapes et les livrables — pas de sous-pages quasi vides.
 */
export default function ServicesPage() {
  const services = listPublicServices();

  return (
    <>
      <SiteHeader />
      <main id="contenu">
        <section className="bg-forest-600 text-white">
          <div className="mx-auto max-w-content px-4 py-12 sm:px-6 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-wide text-ember-200">
              Nos services
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              Tous les services nécessaires pour réussir votre projet
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-forest-100 sm:text-lg">
              De la conception des plans jusqu’au suivi du chantier, Kerplus vous accompagne à
              chaque étape de votre projet de construction.
            </p>
          </div>
        </section>

        {/* Sommaire */}
        <nav
          aria-label="Sommaire des services"
          className="border-b border-sand-200 bg-white"
        >
          <ul className="mx-auto flex max-w-content gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {services.map((service) => (
              <li key={service.key}>
                <Link
                  href={`#${service.slug}`}
                  className="inline-block whitespace-nowrap rounded-full border border-sand-200 px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:border-forest-300 hover:text-forest-600"
                >
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mx-auto max-w-content space-y-10 px-4 py-12 sm:px-6">
          {services.map((service, index) => {
            const Icon = SERVICE_ICONS[service.icon];
            return (
              <section
                key={service.key}
                id={service.slug}
                aria-labelledby={`${service.slug}-titre`}
                className="scroll-mt-24 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-card"
              >
                <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    <div className="flex items-center gap-4">
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                        <Icon width={24} height={24} />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                          Service {index + 1} sur {services.length}
                        </p>
                        <h2
                          id={`${service.slug}-titre`}
                          className="text-xl font-extrabold sm:text-2xl"
                        >
                          {service.title}
                        </h2>
                      </div>
                    </div>

                    <p className="mt-4 text-base leading-relaxed text-ink-soft">
                      {service.objective}
                    </p>

                    <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-forest-700">
                      Prestations comprises
                    </h3>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-ink-soft">
                          <IconCheck
                            width={15}
                            height={15}
                            className="mt-0.5 shrink-0 text-forest-500"
                          />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-forest-700">
                      Étapes de réalisation
                    </h3>
                    <ol className="mt-2 space-y-2">
                      {service.steps.map((step, stepIndex) => (
                        <li key={step} className="flex items-start gap-3 text-sm text-ink-soft">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember-100 text-[11px] font-bold text-ember-800">
                            {stepIndex + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <aside className="flex flex-col gap-4 rounded-xl bg-sand-50 p-5">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-forest-700">
                      <IconFileText width={17} height={17} className="text-forest-600" />
                      Livrables remis
                    </h3>
                    <ul className="space-y-1.5">
                      {service.deliverables.map((deliverable) => (
                        <li
                          key={deliverable}
                          className="flex items-start gap-2 text-sm text-ink-soft"
                        >
                          <IconCheck
                            width={14}
                            height={14}
                            className="mt-0.5 shrink-0 text-forest-500"
                          />
                          {deliverable}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-2">
                      <LinkButton
                        href={`/?service=${service.slug}#estimateur`}
                        size="md"
                        fullWidth
                      >
                        Démarrer mon projet
                      </LinkButton>
                      <p className="mt-2 text-center text-xs text-ink-muted">
                        Le service sera présélectionné dans votre demande.
                      </p>
                    </div>
                  </aside>
                </div>
              </section>
            );
          })}
        </div>

        {/* Appel à l'action final */}
        <section className="bg-forest-600">
          <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
                Vous hésitez sur les services nécessaires ?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-forest-100">
                Commencez par une estimation gratuite : vous pourrez indiquer « conseillez-moi »
                et notre équipe vous orientera lors de l’appel conseil.
              </p>
            </div>
            <LinkButton href="/#estimateur" size="lg" className="shrink-0">
              Estimer mon projet
            </LinkButton>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

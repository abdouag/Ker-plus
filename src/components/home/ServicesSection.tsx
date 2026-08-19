import Link from 'next/link';
import { LinkButton } from '@/components/ui/Button';
import { IconArrowRight, IconCheck } from '@/components/ui/icons';
import { SERVICE_ICONS } from '@/components/services/service-icons';
import { listPublicServices } from '@/lib/content/services';

/**
 * Section « Nos services » de la page d'accueil.
 * Contenus centralisés dans src/lib/content/services.ts — aucun prix affiché.
 */
export function ServicesSection() {
  const services = listPublicServices();
  if (services.length === 0) return null;

  return (
    <section id="services" aria-labelledby="services-titre" className="bg-white">
      <div className="mx-auto max-w-content px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
            Nos services
          </p>
          <h2 id="services-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Tous les services nécessaires pour réussir votre projet
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            De la conception des plans jusqu’au suivi du chantier, Kerplus vous accompagne à
            chaque étape de votre projet de construction.
          </p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = SERVICE_ICONS[service.icon];
            return (
              <li key={service.key}>
                <article className="flex h-full flex-col rounded-2xl border border-sand-200 bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-raised">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                    <Icon width={24} height={24} />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-forest-700">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {service.description}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {service.features.slice(0, 3).map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-1.5 text-sm text-ink-soft"
                      >
                        <IconCheck
                          width={14}
                          height={14}
                          className="mt-1 shrink-0 text-forest-500"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
                    <Link
                      href={`/services#${service.slug}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 underline-offset-2 hover:underline"
                    >
                      En savoir plus
                      <IconArrowRight width={14} height={14} />
                    </Link>
                    <Link
                      href={`/?service=${service.slug}#estimateur`}
                      className="text-sm font-semibold text-ember-600 underline-offset-2 hover:underline"
                    >
                      Ajouter à mon projet
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        <div className="mt-8">
          <LinkButton href="/services" variant="ghost">
            Découvrir tous nos services en détail
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

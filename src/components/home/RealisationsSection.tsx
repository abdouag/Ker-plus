import Image from 'next/image';
import { LinkButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Feedback';
import { IconHome, IconMapPin, IconSparkle } from '@/components/ui/icons';
import { REALISATIONS, type Realisation, type RealisationIllustration } from '@/lib/content/realisations';

/**
 * Section « Nos réalisations » de la page d'accueil.
 * Les contenus vivent dans src/lib/content/realisations.ts : textes, images et
 * liens se remplacent sans toucher à ce composant.
 */
export function RealisationsSection() {
  if (REALISATIONS.length === 0) return null;

  return (
    <section id="realisations" aria-labelledby="realisations-titre" className="bg-white">
      <div className="mx-auto max-w-content px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-ember-500">
            Nos réalisations
          </p>
          <h2 id="realisations-titre" className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Des projets menés avec exigence
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Découvrez quelques projets conçus et réalisés avec exigence, du premier plan
            jusqu’aux dernières finitions.
          </p>
        </div>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {REALISATIONS.map((realisation) => (
            <li key={realisation.slug}>
              <RealisationCard realisation={realisation} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RealisationCard({ realisation }: { realisation: Realisation }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-card transition-shadow duration-200 hover:shadow-raised">
      <div className="relative aspect-[4/3] overflow-hidden">
        {realisation.image ? (
          <Image
            src={realisation.image}
            alt={realisation.imageAlt ?? realisation.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ArchitecturalIllustration variant={realisation.illustration} />
        )}
        {realisation.isDemo ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-soft shadow-card backdrop-blur">
            Projet de démonstration
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-base font-bold text-forest-700">{realisation.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
            <IconMapPin width={15} height={15} className="shrink-0 text-ember-500" />
            {realisation.location}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="info" className="gap-1">
            <IconHome width={12} height={12} />
            {realisation.projectType}
          </Badge>
          <Badge tone="neutral" className="gap-1">
            <IconSparkle width={12} height={12} />
            {realisation.finishLevel}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed text-ink-soft">{realisation.description}</p>

        {realisation.href ? (
          <div className="mt-auto pt-1">
            <LinkButton href={realisation.href} variant="ghost" size="sm">
              Voir le projet
            </LinkButton>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Illustration architecturale neutre affichée tant qu'aucune photo réelle
 * n'est fournie : tracé au trait sur fond dégradé, dans la charte Kerplus.
 */
function ArchitecturalIllustration({ variant }: { variant: RealisationIllustration }) {
  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label="Illustration architecturale du projet"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EEF5F0" />
          <stop offset="100%" stopColor="#F5EFE6" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#sky-${variant})`} />
      {/* Soleil discret */}
      <circle cx="330" cy="64" r="22" fill="#FF8C42" opacity="0.28" />
      {/* Ligne de sol */}
      <line x1="0" y1="248" x2="400" y2="248" stroke="#AE9673" strokeWidth="2" opacity="0.5" />
      <g stroke="#1A4D2E" strokeWidth="3" fill="#FFFFFF" strokeLinejoin="round">
        {variant === 'villa' ? (
          <>
            <rect x="70" y="140" width="170" height="108" />
            <rect x="240" y="108" width="100" height="140" />
            <path d="M60 140h190M232 108h116" strokeWidth="5" />
            <rect x="94" y="164" width="42" height="36" fill="#D6E7DC" />
            <rect x="160" y="164" width="42" height="36" fill="#D6E7DC" />
            <rect x="262" y="132" width="56" height="30" fill="#D6E7DC" />
            <rect x="262" y="184" width="34" height="64" fill="#F5EFE6" />
          </>
        ) : variant === 'duplex' ? (
          <>
            <rect x="100" y="96" width="200" height="152" />
            <path d="M88 96 200 44l112 52" fill="none" strokeWidth="4" />
            <line x1="100" y1="172" x2="300" y2="172" />
            <rect x="124" y="118" width="44" height="34" fill="#D6E7DC" />
            <rect x="232" y="118" width="44" height="34" fill="#D6E7DC" />
            <rect x="124" y="192" width="44" height="34" fill="#D6E7DC" />
            <rect x="216" y="192" width="40" height="56" fill="#F5EFE6" />
          </>
        ) : variant === 'residence' ? (
          <>
            <rect x="84" y="72" width="232" height="176" />
            <line x1="84" y1="130" x2="316" y2="130" />
            <line x1="84" y1="188" x2="316" y2="188" />
            <rect x="106" y="90" width="38" height="24" fill="#D6E7DC" />
            <rect x="180" y="90" width="38" height="24" fill="#D6E7DC" />
            <rect x="254" y="90" width="38" height="24" fill="#D6E7DC" />
            <rect x="106" y="146" width="38" height="24" fill="#D6E7DC" />
            <rect x="180" y="146" width="38" height="24" fill="#D6E7DC" />
            <rect x="254" y="146" width="38" height="24" fill="#D6E7DC" />
            <rect x="182" y="204" width="36" height="44" fill="#F5EFE6" />
          </>
        ) : (
          <>
            <rect x="90" y="128" width="220" height="120" />
            <path d="M78 128 200 76l122 52" fill="none" strokeWidth="4" />
            <rect x="114" y="152" width="46" height="38" fill="#D6E7DC" />
            <rect x="240" y="152" width="46" height="38" fill="#D6E7DC" />
            <rect x="178" y="176" width="42" height="72" fill="#F5EFE6" />
            {/* Échafaudage : chantier de rénovation */}
            <path d="M310 248V96M340 248V96M310 116h30M310 156h30M310 196h30" strokeWidth="2.5" fill="none" />
          </>
        )}
      </g>
    </svg>
  );
}

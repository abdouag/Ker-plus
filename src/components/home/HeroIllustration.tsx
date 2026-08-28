/**
 * Illustration architecturale du bandeau d'accueil — dessin au trait façon
 * plan d'architecte, cohérent avec les vignettes des réalisations. Purement
 * décorative (aria-hidden), aucune image externe.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 320"
      fill="none"
      aria-hidden="true"
      className={className}
      role="presentation"
    >
      {/* Ligne de sol */}
      <line x1="10" y1="272" x2="410" y2="272" stroke="currentColor" strokeWidth="2" opacity="0.55" />

      {/* Corps principal de la maison */}
      <rect x="70" y="132" width="200" height="140" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
      {/* Toit terrasse avec acrotère */}
      <path d="M62 132h216v-14H62z" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
      {/* Aile secondaire */}
      <rect x="270" y="176" width="96" height="96" stroke="currentColor" strokeWidth="2.5" opacity="0.75" />
      <path d="M266 176h104v-12H266z" stroke="currentColor" strokeWidth="2.5" opacity="0.75" />

      {/* Porte */}
      <rect x="150" y="204" width="40" height="68" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
      <circle cx="182" cy="240" r="2.5" fill="currentColor" opacity="0.9" />

      {/* Fenêtres à croisillons */}
      <g stroke="currentColor" strokeWidth="2" opacity="0.85">
        <rect x="92" y="156" width="40" height="32" />
        <line x1="112" y1="156" x2="112" y2="188" />
        <line x1="92" y1="172" x2="132" y2="172" />
        <rect x="208" y="156" width="40" height="32" />
        <line x1="228" y1="156" x2="228" y2="188" />
        <line x1="208" y1="172" x2="248" y2="172" />
        <rect x="292" y="200" width="52" height="28" />
        <line x1="318" y1="200" x2="318" y2="228" />
      </g>

      {/* Casquette au-dessus de la porte */}
      <line x1="142" y1="198" x2="198" y2="198" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />

      {/* Cotes d'architecte (traits + flèches) */}
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.5">
        <line x1="70" y1="296" x2="270" y2="296" />
        <path d="M70 296l8-4v8zM270 296l-8-4v8z" fill="currentColor" stroke="none" />
        <line x1="70" y1="288" x2="70" y2="302" />
        <line x1="270" y1="288" x2="270" y2="302" />
        <line x1="42" y1="132" x2="42" y2="272" />
        <path d="M42 132l-4 8h8zM42 272l-4-8h8z" fill="currentColor" stroke="none" />
        <line x1="34" y1="132" x2="50" y2="132" />
        <line x1="34" y1="272" x2="50" y2="272" />
      </g>

      {/* Soleil / repère orienté — accent orange de la charte */}
      <g stroke="#FF8C42" strokeWidth="2.5">
        <circle cx="352" cy="76" r="20" />
        <line x1="352" y1="44" x2="352" y2="52" />
        <line x1="352" y1="100" x2="352" y2="108" />
        <line x1="320" y1="76" x2="328" y2="76" />
        <line x1="376" y1="76" x2="384" y2="76" />
      </g>

      {/* Arbre */}
      <g stroke="currentColor" strokeWidth="2" opacity="0.7">
        <line x1="386" y1="272" x2="386" y2="244" />
        <circle cx="386" cy="230" r="16" />
      </g>
    </svg>
  );
}

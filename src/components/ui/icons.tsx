import type { SVGProps } from 'react';

/**
 * Bibliothèque d'icônes Kerplus — source unique pour toute l'interface.
 *
 * Tracé 1,75 pt, coins arrondis, `currentColor` : chaque icône hérite de la
 * couleur du texte et se dimensionne via `className` (par défaut 20 px).
 * Toutes sont décoratives par défaut (`aria-hidden`) ; passer `aria-label`
 * et `role="img"` lorsqu'une icône porte du sens seule.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Maison simple — niveau Économique, projets résidentiels. */
export function IconHome(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5v-5h4v5" />
    </Base>
  );
}

/** Maison + garantie — niveau Standard. */
export function IconHomeCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="m9.5 14.5 2 2 3.5-3.5" />
    </Base>
  );
}

/** Éclat — niveau Haut standing. */
export function IconSparkle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z" />
      <path d="M19 15.5c.3 1.6 1 2.4 2.5 2.7-1.5.3-2.2 1.1-2.5 2.7-.3-1.6-1-2.4-2.5-2.7 1.5-.3 2.2-1.1 2.5-2.7Z" />
    </Base>
  );
}

/** Immeuble — types de projets collectifs. */
export function IconBuilding(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1.5" />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01" />
      <path d="M10 20v-3.5h4V20" />
    </Base>
  );
}

/** Règle — surface, mesures. */
export function IconRuler(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.8" y="9" width="18.4" height="6" rx="1.2" transform="rotate(-20 12 12)" />
      <path d="m8.2 12.8 1-2.7M11.6 11.5l.7-1.9M14.9 10.3l1-2.7" />
    </Base>
  );
}

/** Repère de carte — villes et zones. */
export function IconMapPin(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0 1 13 0c0 4.6-6.5 10-6.5 10Z" />
      <circle cx="12" cy="10.6" r="2.3" />
    </Base>
  );
}

/** Coche simple — listes de caractéristiques. */
export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Base>
  );
}

/** Bouclier — fiabilité, sécurité. */
export function IconShield(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-2.5Z" />
      <path d="m9.3 12 2 2 3.4-3.5" />
    </Base>
  );
}

/** Document — rapport détaillé. */
export function IconFileText(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3.5h7L18.5 8v11A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M13.5 3.5V8h5" />
      <path d="M8.5 12h7M8.5 15.5h7" />
    </Base>
  );
}

/** Combiné téléphonique — appel conseil. */
export function IconPhone(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6.8 3.8 9 6c.5.5.5 1.3.1 1.9L8 9.4a12.6 12.6 0 0 0 6.6 6.6l1.5-1.1c.6-.4 1.4-.4 1.9.1l2.2 2.2c.6.6.6 1.6-.1 2.1-1.2 1-2.9 1.6-4.6 1.1-5.1-1.5-9.6-6-11.1-11.1-.5-1.7.1-3.4 1.1-4.6.5-.7 1.5-.7 2.1-.1Z" />
    </Base>
  );
}

/** Horloge — délais. */
export function IconClock(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

/** Éclair — rapidité de l'estimation. */
export function IconBolt(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3Z" />
    </Base>
  );
}

/** Œil ouvert — transparence des hypothèses. */
export function IconEye(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </Base>
  );
}

/** Flèche droite — actions et liens. */
export function IconArrowRight(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Base>
  );
}

/** Menu hamburger — navigation mobile. */
export function IconMenu(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  );
}

/** Croix — fermeture. */
export function IconClose(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}

/** Casque de chantier — réalisations, savoir-faire. */
export function IconHardHat(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 15.5a8 8 0 0 1 16 0" />
      <path d="M10 8V5.8c0-.7.6-1.3 1.3-1.3h1.4c.7 0 1.3.6 1.3 1.3V8" />
      <path d="M3 18.2c0-1 .8-1.7 1.8-1.7h14.4c1 0 1.8.8 1.8 1.7 0 .7-.6 1.3-1.3 1.3H4.3c-.7 0-1.3-.6-1.3-1.3Z" />
    </Base>
  );
}

/** Plan roulé — conception architecturale. */
export function IconBlueprint(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="5.5" width="16" height="13" rx="1.5" />
      <path d="M8.5 5.5v13M8.5 12H20" />
      <path d="M12 8.5h4.5M12 15.5h2.5" />
    </Base>
  );
}

/** Poteaux et poutre — étude béton armé. */
export function IconColumns(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 5h17M3.5 20h17" />
      <path d="M6.5 5v15M12 5v15M17.5 5v15" />
      <path d="M5 8h3M10.5 12h3M16 16h3" />
    </Base>
  );
}

/** Clé à molette — lots techniques (plomberie, électricité). */
export function IconWrench(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14.5 6.5a4 4 0 0 0-5.4 4.8L4 16.4a2 2 0 1 0 2.8 2.9l5.2-5.1a4 4 0 0 0 4.9-5.3l-2.6 2.6-2.3-.6-.6-2.3 3.1-3Z" />
    </Base>
  );
}

/** Cube isométrique — visualisation 3D. */
export function IconCube(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </Base>
  );
}

/** Casque micro — assistance technique. */
export function IconHeadset(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 13a7.5 7.5 0 0 1 15 0" />
      <rect x="3.5" y="12.5" width="4" height="6" rx="1.6" />
      <rect x="16.5" y="12.5" width="4" height="6" rx="1.6" />
      <path d="M19 18.5c0 1.7-1.6 2.5-3.5 2.5h-2" />
    </Base>
  );
}

/** Point d'interrogation cerclé — « conseillez-moi ». */
export function IconHelp(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 3c-.8.5-1 .9-1 1.9" />
      <path d="M12 17h.01" />
    </Base>
  );
}

/**
 * Réalisations affichées sur la page d'accueil.
 *
 * ⚠️ Contenu de DÉMONSTRATION : aucun de ces projets n'est présenté comme une
 * réalisation livrée par Kerplus tant que `isDemo` vaut `true` — la carte
 * affiche alors clairement la mention « Projet de démonstration ».
 *
 * Pour publier de vraies réalisations :
 *  1. déposer les photos dans `public/images/realisations/` ;
 *  2. renseigner `image` avec le chemin (ex. `/images/realisations/villa.jpg`)
 *     et `imageAlt` avec une description de la photo ;
 *  3. passer `isDemo` à `false` ;
 *  4. renseigner `href` si une page ou un article dédié existe — sans lien,
 *     le bouton « Voir le projet » n'est pas affiché.
 * Sans image, la carte affiche une illustration architecturale neutre
 * (`illustration`) : `villa`, `duplex`, `residence` ou `renovation`.
 */

export type RealisationIllustration = 'villa' | 'duplex' | 'residence' | 'renovation';

export interface Realisation {
  /** Identifiant stable, utilisé comme clé React. */
  slug: string;
  name: string;
  location: string;
  projectType: string;
  finishLevel: string;
  description: string;
  /** Photo réelle du projet (chemin sous public/). Laisser vide pour l'illustration. */
  image?: string;
  imageAlt?: string;
  illustration: RealisationIllustration;
  /** Lien vers une page dédiée, si elle existe. */
  href?: string;
  /** true = contenu d'exemple, jamais présenté comme un projet livré. */
  isDemo: boolean;
}

export const REALISATIONS: Realisation[] = [
  {
    slug: 'villa-contemporaine-dakar',
    name: 'Villa contemporaine',
    location: 'Dakar',
    projectType: 'Villa duplex',
    finishLevel: 'Haut standing',
    description:
      'Volumes ouverts, terrasse traversante et menuiseries aluminium sur deux niveaux.',
    illustration: 'villa',
    isDemo: true,
  },
  {
    slug: 'maison-familiale-diamniadio',
    name: 'Maison familiale R+1',
    location: 'Diamniadio',
    projectType: 'Immeuble R+1',
    finishLevel: 'Standard',
    description:
      'Quatre chambres, séjour double et cour arrière, pensés pour la vie de famille.',
    illustration: 'duplex',
    isDemo: true,
  },
  {
    slug: 'residence-moderne-keur-massar',
    name: 'Résidence moderne',
    location: 'Keur Massar',
    projectType: 'Immeuble R+2',
    finishLevel: 'Standard',
    description:
      'Six logements lumineux organisés autour d’une cage d’escalier ventilée.',
    illustration: 'residence',
    isDemo: true,
  },
  {
    slug: 'renovation-villa-almadies',
    name: 'Rénovation complète d’une villa',
    location: 'Almadies',
    projectType: 'Maison individuelle',
    finishLevel: 'Haut standing',
    description:
      'Reprise structurelle, redistribution des pièces et finitions haut de gamme.',
    illustration: 'renovation',
    isDemo: true,
  },
];

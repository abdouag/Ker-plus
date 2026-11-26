/**
 * Référentiels initiaux Kër Care, insérés par le seed sans jamais écraser une
 * valeur modifiée depuis l'administration. Les fréquences d'entretien sont
 * des valeurs indicatives, pas des règles universelles.
 */

export const DEFAULT_CARE_CATEGORIES = [
  {
    slug: 'plomberie',
    name: 'Plomberie',
    description: 'Fuites, robinetterie, WC bouchés, évacuations.',
    services: ['Fuite d’eau', 'Robinet', 'WC bouché', 'Évacuation'],
  },
  {
    slug: 'electricite',
    name: 'Électricité',
    description: 'Prises, éclairage, disjoncteurs et tableaux électriques.',
    services: ['Prise', 'Éclairage', 'Disjoncteur', 'Tableau électrique'],
  },
  {
    slug: 'climatisation',
    name: 'Climatisation',
    description: 'Entretien, pannes et fuites de climatiseurs.',
    services: ['Entretien', 'Panne', 'Fuite'],
  },
  {
    slug: 'pompe-reservoir',
    name: 'Pompe et réservoir',
    description: 'Pompes à eau, surpresseurs, réservoirs et bâches.',
    services: ['Pompe à eau', 'Surpresseur', 'Nettoyage de réservoir'],
  },
  {
    slug: 'chauffe-eau',
    name: 'Chauffe-eau',
    description: 'Installation, entretien et dépannage de chauffe-eau.',
    services: ['Entretien', 'Panne', 'Remplacement'],
  },
  {
    slug: 'solaire',
    name: 'Solaire',
    description: 'Panneaux, onduleurs et batteries.',
    services: ['Nettoyage des panneaux', 'Onduleur', 'Batteries'],
  },
  {
    slug: 'serrurerie',
    name: 'Serrurerie',
    description: 'Serrures, portes, portails.',
    services: ['Serrure', 'Porte', 'Portail'],
  },
  {
    slug: 'menuiserie',
    name: 'Menuiserie',
    description: 'Portes, fenêtres, placards.',
    services: ['Porte', 'Fenêtre', 'Placard'],
  },
  {
    slug: 'peinture',
    name: 'Peinture',
    description: 'Retouches et remise en peinture.',
    services: ['Retouches', 'Pièce complète', 'Façade'],
  },
  {
    slug: 'maconnerie',
    name: 'Maçonnerie, humidité et toiture',
    description: 'Fissures, infiltrations, étanchéité et toiture.',
    services: ['Fissure', 'Infiltration', 'Étanchéité', 'Toiture'],
  },
  {
    slug: 'autre',
    name: 'Autre besoin',
    description: 'Décrivez votre besoin, Kerplus vous oriente.',
    services: [],
  },
] as const;

export const DEFAULT_EQUIPMENT_TYPES = [
  { slug: 'climatiseur', name: 'Climatiseur', category: 'climatisation', months: 6, recommendation: 'Nettoyage des filtres et contrôle du gaz.' },
  { slug: 'pompe-eau', name: 'Pompe à eau', category: 'pompe-reservoir', months: 12, recommendation: 'Contrôle de la pression et de l’étanchéité.' },
  { slug: 'surpresseur', name: 'Surpresseur', category: 'pompe-reservoir', months: 12, recommendation: 'Contrôle du ballon et du pressostat.' },
  { slug: 'reservoir', name: 'Réservoir / bâche à eau', category: 'pompe-reservoir', months: 6, recommendation: 'Nettoyage et désinfection.' },
  { slug: 'chauffe-eau', name: 'Chauffe-eau', category: 'chauffe-eau', months: 12, recommendation: 'Détartrage et contrôle de l’anode.' },
  { slug: 'groupe-electrogene', name: 'Groupe électrogène', category: 'electricite', months: 6, recommendation: 'Vidange, filtres et essai en charge.' },
  { slug: 'solaire', name: 'Installation solaire', category: 'solaire', months: 6, recommendation: 'Nettoyage des panneaux et contrôle des batteries.' },
  { slug: 'installation-electrique', name: 'Installation électrique', category: 'electricite', months: 24, recommendation: 'Contrôle du tableau et des protections.' },
  { slug: 'plomberie', name: 'Plomberie', category: 'plomberie', months: 12, recommendation: 'Recherche de fuites et contrôle des évacuations.' },
  { slug: 'portail', name: 'Portail', category: 'serrurerie', months: 12, recommendation: 'Graissage et contrôle de la motorisation.' },
  { slug: 'toiture', name: 'Toiture / terrasse', category: 'maconnerie', months: 12, recommendation: 'Contrôle de l’étanchéité avant l’hivernage.' },
  { slug: 'autre', name: 'Autre équipement', category: 'autre', months: null, recommendation: null },
] as const;

/** Offres indicatives — hypothèses commerciales non souscriptibles. */
export const DEFAULT_CARE_PLANS = [
  {
    slug: 'gratuit',
    name: 'Gratuit / à la demande',
    monthlyPrice: 0,
    benefits: ['Carnet numérique de base', 'Demandes d’intervention et historique', 'Interventions facturées sur devis'],
  },
  {
    slug: 'basic',
    name: 'Basic',
    monthlyPrice: 5_000,
    benefits: ['Rappels d’entretien avancés', 'Conseils d’entretien', 'Suivi du carnet'],
  },
  {
    slug: 'plus',
    name: 'Plus',
    monthlyPrice: 10_000,
    benefits: ['Avantages Basic', 'Priorité de traitement', 'Inspection périodique plafonnée', 'Remises configurables'],
  },
  {
    slug: 'premium',
    name: 'Premium',
    monthlyPrice: 20_000,
    benefits: ['Avantages Plus', 'Suivi renforcé', 'Inspections plafonnées', 'Rapport annuel', 'Priorité et remises renforcées'],
  },
] as const;

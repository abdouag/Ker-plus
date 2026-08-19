/**
 * Catalogue des services Kerplus — source unique pour la page d'accueil,
 * la page /services, le formulaire de commande, la page de confirmation et
 * l'administration.
 *
 * Les clés (`key`) sont des valeurs contrôlées, persistées en base dans
 * `Order.requestedServices` et `OrderService.serviceKey` : ne jamais les
 * renommer sans migration. Textes, prestations, livrables et ordre
 * d'affichage se modifient librement ici.
 */

export const SERVICE_KEYS = [
  'architectural_design',
  'structural_engineering',
  'technical_systems',
  '3d_visualization',
  'technical_assistance',
  'construction_monitoring',
  'needs_guidance',
] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

export type ServiceIconName =
  | 'blueprint'
  | 'columns'
  | 'wrench'
  | 'cube'
  | 'headset'
  | 'hardhat'
  | 'help';

export interface ServiceDefinition {
  key: ServiceKey;
  slug: string;
  title: string;
  /** Icône rendue par SERVICE_ICONS (bibliothèque unique du projet). */
  icon: ServiceIconName;
  /** Description courte — cartes de l'accueil et du formulaire. */
  description: string;
  /** Objectif détaillé — page /services. */
  objective: string;
  /** Prestations principales (2 à 3 affichées sur les cartes). */
  features: string[];
  /** Livrables remis au client. */
  deliverables: string[];
  /** Étapes de réalisation. */
  steps: string[];
  displayOrder: number;
  active: boolean;
  /**
   * false : option du formulaire uniquement (« conseillez-moi »), jamais
   * présentée comme un service sur l'accueil ou la page /services.
   */
  standalone: boolean;
}

export const SERVICES: ServiceDefinition[] = [
  {
    key: 'architectural_design',
    slug: 'conception-architecturale',
    title: 'Conception architecturale',
    icon: 'blueprint',
    description:
      'Création de plans fonctionnels, modernes et adaptés à votre terrain, à vos besoins et à votre mode de vie.',
    objective:
      'Traduire votre projet de vie en plans clairs et constructibles : implantation sur le terrain, organisation des pièces, circulation, lumière et évolutions futures sont pensées dès cette étape.',
    features: ['Plans architecturaux', 'Organisation des espaces', 'Plans de façades et de niveaux'],
    deliverables: [
      'Plans de distribution par niveau',
      'Plans de façades',
      'Plan d’implantation sur le terrain',
    ],
    steps: [
      'Échange sur vos besoins, votre terrain et votre budget',
      'Esquisse et validation de l’organisation des espaces',
      'Mise au point des plans définitifs',
    ],
    displayOrder: 1,
    active: true,
    standalone: true,
  },
  {
    key: 'structural_engineering',
    slug: 'etude-beton-arme',
    title: 'Étude béton armé',
    icon: 'columns',
    description:
      'Étude de la structure du bâtiment afin de garantir sa stabilité, sa résistance et sa sécurité.',
    objective:
      'Dimensionner la structure porteuse de votre bâtiment — fondations, poteaux, poutres et planchers — pour construire solide, durable et sans surcoût de matériaux inutile.',
    features: [
      'Dimensionnement de la structure',
      'Plans de fondations',
      'Plans de coffrage et de ferraillage',
    ],
    deliverables: [
      'Note de dimensionnement de la structure',
      'Plans de fondations',
      'Plans de coffrage et de ferraillage',
    ],
    steps: [
      'Analyse des plans architecturaux et des charges',
      'Calculs de structure et dimensionnement',
      'Production des plans d’exécution',
    ],
    displayOrder: 2,
    active: true,
    standalone: true,
  },
  {
    key: 'technical_systems',
    slug: 'lots-techniques',
    title: 'Études des lots techniques',
    icon: 'wrench',
    description:
      'Préparation des plans techniques nécessaires à une installation fiable de la plomberie et de l’électricité.',
    objective:
      'Prévoir dès la conception les réseaux d’eau et d’électricité : positionnement des équipements, cheminement des réseaux et points de raccordement, pour éviter les reprises coûteuses en cours de chantier.',
    features: [
      'Plans de plomberie',
      'Plans électriques',
      'Positionnement des équipements et des réseaux',
    ],
    deliverables: [
      'Plans de plomberie et d’évacuation',
      'Plans électriques et schéma du tableau',
      'Repérage des équipements et points de raccordement',
    ],
    steps: [
      'Recueil de vos besoins en équipements',
      'Conception des réseaux sur la base des plans',
      'Production des plans techniques',
    ],
    displayOrder: 3,
    active: true,
    standalone: true,
  },
  {
    key: '3d_visualization',
    slug: 'visualisation-3d',
    title: 'Visualisation 3D',
    icon: 'cube',
    description:
      'Visualisation réaliste du projet avant le démarrage des travaux afin de mieux comprendre et valider le résultat final.',
    objective:
      'Voir votre future maison avant de la construire : les rendus 3D permettent de valider les volumes, les façades et les ambiances intérieures, et d’ajuster les choix avant d’engager les travaux.',
    features: ['Vues extérieures', 'Aménagement intérieur', 'Rendus réalistes du projet'],
    deliverables: [
      'Vues extérieures du projet',
      'Vues intérieures des pièces principales',
      'Images en haute définition',
    ],
    steps: [
      'Modélisation du projet à partir des plans',
      'Choix des matériaux et des ambiances',
      'Production des rendus définitifs',
    ],
    displayOrder: 4,
    active: true,
    standalone: true,
  },
  {
    key: 'technical_assistance',
    slug: 'assistance-technique',
    title: 'Assistance technique',
    icon: 'headset',
    description:
      'Accompagnement par des professionnels pour sécuriser les décisions techniques durant le projet.',
    objective:
      'Disposer d’un interlocuteur technique de confiance tout au long du projet : relecture de documents, comparaison des solutions, aide au choix des matériaux et des entreprises.',
    features: [
      'Conseils techniques',
      'Analyse des documents',
      'Aide au choix des solutions et des matériaux',
    ],
    deliverables: [
      'Avis techniques écrits',
      'Comptes rendus d’analyse de documents',
      'Recommandations de solutions et de matériaux',
    ],
    steps: [
      'Point de cadrage sur vos besoins',
      'Analyse des documents et des questions techniques',
      'Restitution des avis et recommandations',
    ],
    displayOrder: 5,
    active: true,
    standalone: true,
  },
  {
    key: 'construction_monitoring',
    slug: 'suivi-chantier',
    title: 'Suivi de chantier',
    icon: 'hardhat',
    description:
      'Suivi régulier de l’avancement des travaux pour vérifier leur conformité avec les plans et les exigences du projet.',
    objective:
      'Garder la maîtrise de votre chantier, même à distance : visites régulières, vérification de la conformité aux plans et rapports illustrés pour suivre l’avancement en toute confiance.',
    features: [
      'Contrôle de l’avancement',
      'Rapports et observations',
      'Suivi des différentes étapes du chantier',
    ],
    deliverables: [
      'Rapports de visite illustrés',
      'Relevé des observations et réserves',
      'Points d’étape aux moments clés du chantier',
    ],
    steps: [
      'Définition du rythme de visites',
      'Visites de chantier et vérifications',
      'Rapports et suivi des observations',
    ],
    displayOrder: 6,
    active: true,
    standalone: true,
  },
  {
    key: 'needs_guidance',
    slug: 'conseillez-moi',
    title: 'Je ne sais pas encore — conseillez-moi',
    icon: 'help',
    description:
      'Notre équipe analyse votre projet et vous oriente vers les services réellement utiles à votre situation.',
    objective: '',
    features: [],
    deliverables: [],
    steps: [],
    displayOrder: 99,
    active: true,
    standalone: false,
  },
];

/** Services présentés publiquement (accueil, /services), triés. */
export function listPublicServices(): ServiceDefinition[] {
  return SERVICES.filter((service) => service.active && service.standalone).sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
}

/** Options proposées dans le formulaire (services + « conseillez-moi »). */
export function listSelectableServices(): ServiceDefinition[] {
  return SERVICES.filter((service) => service.active).sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
}

export function getServiceByKey(key: string): ServiceDefinition | undefined {
  return SERVICES.find((service) => service.key === key);
}

export function getServiceBySlug(slug: string): ServiceDefinition | undefined {
  return SERVICES.find((service) => service.slug === slug);
}

/** Libellé lisible d'une clé persistée (repli : la clé brute). */
export function serviceLabel(key: string): string {
  return getServiceByKey(key)?.title ?? key;
}

// ---------------------------------------------------------------------------
// Statuts de suivi d'un service (miroir de l'enum Prisma ServiceStatus)
// ---------------------------------------------------------------------------

export const SERVICE_STATUSES = [
  'NOT_STARTED',
  'INFO_REQUIRED',
  'IN_PROGRESS',
  'DOCUMENT_AVAILABLE',
  'COMPLETED',
] as const;

export type ServiceStatusKey = (typeof SERVICE_STATUSES)[number];

export const SERVICE_STATUS_LABELS: Record<ServiceStatusKey, string> = {
  NOT_STARTED: 'Non démarré',
  INFO_REQUIRED: 'Informations requises',
  IN_PROGRESS: 'En cours',
  DOCUMENT_AVAILABLE: 'Document disponible',
  COMPLETED: 'Terminé',
};

/** Ton visuel associé à chaque statut (badges de l'interface). */
export const SERVICE_STATUS_TONES: Record<
  ServiceStatusKey,
  'neutral' | 'warning' | 'info' | 'success'
> = {
  NOT_STARTED: 'neutral',
  INFO_REQUIRED: 'warning',
  IN_PROGRESS: 'info',
  DOCUMENT_AVAILABLE: 'info',
  COMPLETED: 'success',
};

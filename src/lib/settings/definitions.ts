import type { SettingType } from '@prisma/client';

/**
 * Registre des paramètres administrables.
 *
 * Chaque paramètre déclare sa valeur par défaut, son type, son libellé et son
 * groupe d'affichage dans /admin/parametres. Le seed insère ces valeurs sans
 * jamais écraser une valeur déjà personnalisée.
 */

export interface SettingDefinition {
  key: string;
  type: SettingType;
  label: string;
  group: SettingGroup;
  defaultValue: string;
  help?: string;
  /** Bornes de validation pour les types numériques. */
  min?: number;
  max?: number;
}

export type SettingGroup =
  'estimation' | 'commercial' | 'contact' | 'textes' | 'paiement' | 'kercare';

export const SETTING_GROUP_LABELS: Record<SettingGroup, string> = {
  estimation: 'Paramètres de calcul',
  commercial: 'Offre et délais',
  contact: 'Coordonnées Kerplus',
  textes: 'Textes affichés',
  paiement: 'Paiement',
  kercare: 'Kër Care',
};

export const DEFAULT_EXCLUSIONS = [
  'Le prix du terrain et les frais liés à son acquisition',
  "L'étude de sol et les études techniques spécifiques",
  'Les honoraires professionnels (architecte, bureau d’études, contrôle technique)',
  'Les taxes, autorisations et frais administratifs',
  'Les raccordements aux réseaux (eau, électricité, assainissement)',
  'Les travaux de terrassement lourds ou de soutènement',
  'Les aménagements extérieurs (clôture, portail, piscine, paysagisme)',
  'Le mobilier, l’électroménager et la décoration',
  'Les équipements spéciaux (ascenseur, groupe électrogène, panneaux solaires)',
];

export const DEFAULT_VARIATION_FACTORS = [
  'La nature du terrain',
  "Les résultats de l'étude de sol",
  'Les plans définitifs retenus',
  'La structure du bâtiment',
  'L’évolution du prix des matériaux',
  'Les contraintes d’accès au chantier',
  'Les équipements choisis',
  'Les honoraires professionnels',
  'Les raccordements aux réseaux',
  'Les taxes et autorisations',
];

export const SETTING_KEYS = {
  RANGE_PERCENTAGE: 'range_percentage',
  PREMIUM_REPORT_PRICE: 'premium_report_price_xof',
  REPORT_DELIVERY_HOURS: 'report_delivery_hours',
  CALL_DURATION_MINUTES: 'call_duration_minutes',
  WAVE_PAYMENT_URL: 'wave_payment_url',
  PAYMENT_INSTRUCTIONS: 'payment_instructions',
  COMPANY_NAME: 'company_name',
  COMPANY_EMAIL: 'company_email',
  COMPANY_PHONE: 'company_phone',
  COMPANY_WHATSAPP: 'company_whatsapp',
  COMPANY_ADDRESS: 'company_address',
  COMPANY_LEGAL_INFO: 'company_legal_info',
  DISCLAIMER_TEXT: 'disclaimer_text',
  ASSUMPTIONS_TEXT: 'assumptions_text',
  EXCLUSIONS: 'exclusions',
  VARIATION_FACTORS: 'variation_factors',
  ESTIMATOR_ENABLED: 'estimator_enabled',
  ORDER_ENABLED: 'order_enabled',
  CARE_ENABLED: 'care_enabled',
  CARE_SIGNUP_ENABLED: 'care_signup_enabled',
  CARE_COMMISSION_RATE: 'care_commission_rate',
  CARE_QUOTE_VALIDITY_DAYS: 'care_quote_validity_days',
  CARE_EMERGENCY_TEXT: 'care_emergency_text',
  CARE_CANCELLATION_TERMS: 'care_cancellation_terms',
  CARE_ZONE_TEXT: 'care_zone_text',
} as const;

export const DEFAULT_CARE_EMERGENCY_TEXT = [
  'Kër Care n’est pas un service de secours.',
  'En cas d’odeur de gaz, de fumée, d’incendie, de risque d’électrocution ou d’effondrement : éloignez-vous de la zone, coupez si possible le gaz et le disjoncteur général sans prendre de risque, et appelez immédiatement les secours.',
  'Sapeurs-pompiers : 18 · SAMU : 1515 · Police : 17.',
  'Vérifiez ces numéros auprès des autorités locales.',
].join('\n');

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: SETTING_KEYS.RANGE_PERCENTAGE,
    type: 'INTEGER',
    label: 'Variation de la fourchette (×100)',
    group: 'estimation',
    defaultValue: '1000',
    help: 'Exprimée en centièmes de pourcent : 1000 = 10 %.',
    min: 0,
    max: 5000,
  },
  {
    key: SETTING_KEYS.PREMIUM_REPORT_PRICE,
    type: 'INTEGER',
    label: 'Prix du rapport détaillé (FCFA)',
    group: 'commercial',
    defaultValue: '50000',
    min: 0,
    max: 100_000_000,
  },
  {
    key: SETTING_KEYS.REPORT_DELIVERY_HOURS,
    type: 'INTEGER',
    label: 'Délai de livraison annoncé (heures)',
    group: 'commercial',
    defaultValue: '48',
    min: 1,
    max: 720,
  },
  {
    key: SETTING_KEYS.CALL_DURATION_MINUTES,
    type: 'INTEGER',
    label: 'Durée de l’appel conseil (minutes)',
    group: 'commercial',
    defaultValue: '20',
    min: 5,
    max: 240,
  },
  {
    key: SETTING_KEYS.WAVE_PAYMENT_URL,
    type: 'STRING',
    label: 'Lien de paiement Wave',
    group: 'paiement',
    defaultValue: '',
    help: 'Laisser vide pour utiliser la variable d’environnement WAVE_PAYMENT_URL.',
  },
  {
    key: SETTING_KEYS.PAYMENT_INSTRUCTIONS,
    type: 'TEXT',
    label: 'Instructions de paiement affichées au client',
    group: 'paiement',
    defaultValue:
      "Effectuez le paiement via Wave en indiquant le numéro de commande en référence, puis transmettez-nous l'identifiant de la transaction Wave. Votre commande est confirmée dès que notre équipe a vérifié le paiement.",
  },
  {
    key: SETTING_KEYS.COMPANY_NAME,
    type: 'STRING',
    label: 'Nom commercial',
    group: 'contact',
    defaultValue: 'Kerplus.sn',
  },
  {
    key: SETTING_KEYS.COMPANY_EMAIL,
    type: 'STRING',
    label: 'Email de contact',
    group: 'contact',
    defaultValue: 'contact@kerplus.sn',
  },
  {
    key: SETTING_KEYS.COMPANY_PHONE,
    type: 'STRING',
    label: 'Téléphone',
    group: 'contact',
    defaultValue: '',
    help: 'À renseigner par Kerplus. Le bloc de contact reste masqué tant que le champ est vide.',
  },
  {
    key: SETTING_KEYS.COMPANY_WHATSAPP,
    type: 'STRING',
    label: 'Numéro WhatsApp',
    group: 'contact',
    defaultValue: '',
    help: 'Format international, par exemple +221770000000. Le bouton WhatsApp est masqué si vide.',
  },
  {
    key: SETTING_KEYS.COMPANY_ADDRESS,
    type: 'TEXT',
    label: 'Adresse',
    group: 'contact',
    defaultValue: '',
  },
  {
    key: SETTING_KEYS.COMPANY_LEGAL_INFO,
    type: 'TEXT',
    label: 'Informations légales (forme juridique, RC, NINEA, directeur de publication)',
    group: 'contact',
    defaultValue:
      '[À COMPLÉTER PAR KERPLUS] Forme juridique, capital social, numéro RCCM, NINEA, siège social, directeur de la publication et hébergeur.',
    help: 'Ce texte alimente la page Mentions légales. Aucune donnée juridique fictive n’est publiée.',
  },
  {
    key: SETTING_KEYS.DISCLAIMER_TEXT,
    type: 'TEXT',
    label: 'Avertissement affiché sous l’estimation',
    group: 'textes',
    defaultValue:
      'Cette estimation est indicative. Elle ne constitue ni un devis contractuel, ni une étude technique, ni un engagement de prix. Le montant réel de votre projet peut varier sensiblement.',
  },
  {
    key: SETTING_KEYS.ASSUMPTIONS_TEXT,
    type: 'TEXT',
    label: 'Hypothèses de calcul',
    group: 'textes',
    defaultValue:
      "Le calcul retient un prix moyen au m² construit, appliqué à la surface totale tous niveaux confondus, ajusté par un coefficient de localisation et un coefficient lié au type de projet. Il suppose un terrain déjà viabilisé, plat et accessible, ainsi qu'une construction en maçonnerie traditionnelle conforme aux pratiques courantes au Sénégal.",
  },
  {
    key: SETTING_KEYS.EXCLUSIONS,
    type: 'JSON',
    label: 'Postes exclus de l’estimation',
    group: 'textes',
    defaultValue: JSON.stringify(DEFAULT_EXCLUSIONS),
    help: 'Une ligne par poste exclu.',
  },
  {
    key: SETTING_KEYS.VARIATION_FACTORS,
    type: 'JSON',
    label: 'Facteurs de variation du montant',
    group: 'textes',
    defaultValue: JSON.stringify(DEFAULT_VARIATION_FACTORS),
    help: 'Une ligne par facteur.',
  },
  {
    key: SETTING_KEYS.ESTIMATOR_ENABLED,
    type: 'BOOLEAN',
    label: 'Estimateur public actif',
    group: 'commercial',
    defaultValue: 'true',
  },
  {
    key: SETTING_KEYS.ORDER_ENABLED,
    type: 'BOOLEAN',
    label: 'Commande du rapport active',
    group: 'commercial',
    defaultValue: 'true',
  },
  {
    key: SETTING_KEYS.CARE_ENABLED,
    type: 'BOOLEAN',
    label: 'Demandes d’intervention Kër Care ouvertes',
    group: 'kercare',
    defaultValue: 'true',
    help: 'Désactivé : la page Kër Care reste visible mais aucune nouvelle demande n’est acceptée.',
  },
  {
    key: SETTING_KEYS.CARE_SIGNUP_ENABLED,
    type: 'BOOLEAN',
    label: 'Création de compte client ouverte',
    group: 'kercare',
    defaultValue: 'true',
  },
  {
    key: SETTING_KEYS.CARE_COMMISSION_RATE,
    type: 'INTEGER',
    label: 'Commission Kerplus sur les interventions (×100, 1000 = 10 %)',
    group: 'kercare',
    defaultValue: '1000',
    min: 0,
    max: 5000,
    help: 'Hypothèse initiale à valider. Utilisée pour la répartition indicative affichée en administration.',
  },
  {
    key: SETTING_KEYS.CARE_QUOTE_VALIDITY_DAYS,
    type: 'INTEGER',
    label: 'Durée de validité par défaut des devis (jours)',
    group: 'kercare',
    defaultValue: '15',
    min: 1,
    max: 90,
  },
  {
    key: SETTING_KEYS.CARE_ZONE_TEXT,
    type: 'STRING',
    label: 'Zone desservie (texte affiché)',
    group: 'kercare',
    defaultValue: 'Dakar et sa banlieue',
  },
  {
    key: SETTING_KEYS.CARE_EMERGENCY_TEXT,
    type: 'TEXT',
    label: 'Consignes en cas de danger immédiat',
    group: 'kercare',
    defaultValue: DEFAULT_CARE_EMERGENCY_TEXT,
    help: 'Affiché lorsque le client signale un danger. Vérifier les numéros d’urgence avant lancement.',
  },
  {
    key: SETTING_KEYS.CARE_CANCELLATION_TERMS,
    type: 'TEXT',
    label: 'Conditions d’annulation et de report',
    group: 'kercare',
    defaultValue:
      'Vous pouvez annuler gratuitement votre demande tant qu’aucun rendez-vous n’est confirmé. Un rendez-vous confirmé peut être reporté depuis votre espace ; les frais de déplacement ou de diagnostic annoncés restent dus si le prestataire s’est déjà déplacé. Conditions indicatives, à valider avant lancement commercial.',
  },
];

export const SETTING_DEFINITION_BY_KEY = new Map(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition]),
);

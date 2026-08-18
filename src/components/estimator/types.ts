/** Données de référentiel transmises au composant client de l'estimateur. */
export interface ProjectTypeOption {
  id: string;
  name: string;
  description: string | null;
  coefficient: number;
}

export interface CityZoneOption {
  id: string;
  name: string;
  coefficient: number;
}

export interface FinishLevelOption {
  id: string;
  name: string;
  /** Slug stable du référentiel — pilote l'icône et le badge « Le plus choisi ». */
  slug: string;
  description: string | null;
  /** Utilisé uniquement pour le calcul instantané : jamais affiché au visiteur. */
  pricePerSquareMeter: number;
}

export interface EstimatorReferentials {
  projectTypes: ProjectTypeOption[];
  cityZones: CityZoneOption[];
  finishLevels: FinishLevelOption[];
  rangePercentage: number;
}

export interface EstimatorTexts {
  disclaimer: string;
  assumptions: string;
  exclusions: string[];
  variationFactors: string[];
  reportPrice: number;
  deliveryHours: number;
  callDurationMinutes: number;
  orderEnabled: boolean;
}

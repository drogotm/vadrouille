/** Paramètres du moteur — chaque valeur est justifiée dans CLAUDE.md § Moteur de décision. */
import type { CriterionKey, Importance } from './types.ts';

export interface EngineConfig {
  /** Match Score = meanWeight × moyenne + minWeight × satisfaction du moins bien servi */
  meanWeight: number;
  minWeight: number;
  /** poids relatif de chaque critère dans la satisfaction individuelle */
  criterionWeights: Record<CriterionKey, number>;
  /** multiplicateur selon l'importance déclarée */
  importanceMultipliers: Record<Importance, number>;
  /** poids d'un « peut-être » (vs « dispo » = 1) dans le choix du week-end et la moyenne */
  maybeWeight: number;
  /** pas de dépaysement : satisfaction × homePenalty si la destination est sa propre ville */
  homePenalty: number;
  /** Budget Match : Match Score ≥ max(budgetFloorAbs, best − budgetFloorGap) */
  budgetFloorAbs: number;
  budgetFloorGap: number;
  /** Wild Card : Match Score ≥ max(wildFloorAbs, best − wildFloorGap) */
  wildFloorAbs: number;
  wildFloorGap: number;
  /** nombre minimum de membres présents pour afficher des agrégats (anti-réidentification) */
  privacyThreshold: number;
  /** écart d'ambiance toléré si l'ambiance est « indispensable » */
  ambianceTolerance: number;
  /** probabilité de beau temps minimale si la météo est « indispensable » */
  weatherHardThreshold: number;
  /**
   * Budget et temps de trajet sont des critères « rédhibitoires » : au-delà de la limite,
   * la satisfaction globale est multipliée par un facteur qui descend jusqu'à ce plancher
   * (souhaitable) — plus doux si le critère est « négociable ».
   */
  dealbreakerFloor: Record<'souhaitable' | 'negociable', number>;
  /** au-delà de cette durée aller (min), un mode de transport n'est pas envisageable pour un week-end */
  maxOneWayMinutes: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  meanWeight: 0.7,
  minWeight: 0.3,
  criterionWeights: {
    budget: 3,
    envies: 3,
    travelTime: 2.5,
    cadres: 2,
    transports: 1.5,
    ambiance: 1.5,
    comfort: 1,
    weather: 1,
  },
  importanceMultipliers: {
    indispensable: 1.5,
    souhaitable: 1,
    negociable: 0.4,
  },
  maybeWeight: 0.5,
  homePenalty: 0.6,
  budgetFloorAbs: 50,
  budgetFloorGap: 15,
  wildFloorAbs: 40,
  wildFloorGap: 30,
  privacyThreshold: 4,
  ambianceTolerance: 0.35,
  weatherHardThreshold: 0.6,
  dealbreakerFloor: { souhaitable: 0.4, negociable: 0.7 },
  maxOneWayMinutes: 9 * 60,
};

export function resolveConfig(partial?: Partial<EngineConfig>): EngineConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    criterionWeights: { ...DEFAULT_CONFIG.criterionWeights, ...partial?.criterionWeights },
    importanceMultipliers: { ...DEFAULT_CONFIG.importanceMultipliers, ...partial?.importanceMultipliers },
    dealbreakerFloor: { ...DEFAULT_CONFIG.dealbreakerFloor, ...partial?.dealbreakerFloor },
  };
}

import type { CriterionKey, Importance } from './types.ts';

export const ENGINE_VERSION = '1.0.0';

/**
 * Tous les réglages du moteur, au même endroit. Chaque valeur est justifiée dans
 * CLAUDE.md (« Moteur de décision »). Modifier une valeur = relancer `npm test`.
 */
export interface EngineConfig {
  /** Match Score = mean × moyenne + min × membre le moins bien servi. */
  fairness: { mean: number; min: number };
  importanceWeight: Record<Importance, number>;
  baseWeight: Record<CriterionKey, number>;
  /** Dépassement de budget (en proportion) au-delà duquel la satisfaction tombe à 0. */
  budgetTolerance: number;
  /** Idem pour le temps de trajet. */
  travelTolerance: number;
  /** Poids d'un « peut-être » dans le choix du week-end. */
  maybeWeight: number;
  /** Plancher du Budget Match : max(absolute, best − belowBest). */
  budgetFloor: { absolute: number; belowBest: number };
  wildFloor: { absolute: number; belowBest: number };
  /** Part de l'originalité (1 − popularité) dans le classement Wild Card. */
  wildOriginalityWeight: number;
  /** Confidentialité : en dessous, aucun décompte « k/n » n'est publié. */
  minAggregateGroup: number;
  /** Confidentialité : un décompte d'envie n'est publié que si au moins k membres. */
  minAggregateCount: number;
  /** Confidentialité : en dessous, le diagnostic ne nomme pas le critère bloquant. */
  diagnosticMinGroup: number;
  /** Sous le seuil d'agrégats, le coût moyen est arrondi à ce pas (€). */
  smallGroupCostRounding: number;
  /** Météo « indispensable » : ensoleillement minimal exigé. */
  mustWeatherMinSun: number;
  /** Ambiance « indispensable » : écart maximal toléré (échelle 0–1). */
  mustAmbianceMaxGap: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  fairness: { mean: 0.7, min: 0.3 },
  importanceWeight: { must: 3, nice: 2, flex: 1 },
  baseWeight: {
    budget: 1.5,
    travelTime: 1,
    transports: 1,
    cadres: 1,
    envies: 1,
    comfort: 0.75,
    weather: 0.75,
    ambiance: 0.75,
  },
  budgetTolerance: 0.3,
  travelTolerance: 0.5,
  maybeWeight: 0.5,
  budgetFloor: { absolute: 50, belowBest: 20 },
  wildFloor: { absolute: 45, belowBest: 30 },
  wildOriginalityWeight: 0.45,
  minAggregateGroup: 4,
  minAggregateCount: 2,
  diagnosticMinGroup: 3,
  smallGroupCostRounding: 10,
  mustWeatherMinSun: 0.5,
  mustAmbianceMaxGap: 0.34,
};

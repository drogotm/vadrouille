/**
 * Paramètres de coût — ESTIMATIONS éditables à la main.
 * Les montants de base sont multipliés par le costIndex de la destination.
 */
import type { ClimateZone, ComfortId } from '../engine/types.ts';

/** Logement par personne et par nuit (€), location partagée par le groupe. */
export const LODGING_PER_NIGHT: Record<ComfortId, number> = {
  roots: 28,
  confortable: 50,
  premium: 95,
};

/** Repas par personne et par jour (€). */
export const FOOD_PER_DAY: Record<ComfortId, number> = {
  roots: 28,
  confortable: 45,
  premium: 75,
};

/** Les activités suivent un peu le niveau de confort choisi. */
export const ACTIVITY_FACTOR: Record<ComfortId, number> = {
  roots: 0.75,
  confortable: 1,
  premium: 1.35,
};

/**
 * Probabilité estimée de beau temps par mois (janvier → décembre), par zone climatique.
 * Ordre de grandeur issu des moyennes d'ensoleillement ; à remplacer par une vraie source météo.
 */
export const SUNSHINE_BY_ZONE: Record<ClimateZone, readonly number[]> = {
  mediterraneen: [0.62, 0.64, 0.68, 0.7, 0.78, 0.88, 0.95, 0.92, 0.84, 0.72, 0.62, 0.6],
  iberique: [0.55, 0.58, 0.65, 0.68, 0.75, 0.85, 0.92, 0.92, 0.84, 0.7, 0.58, 0.55],
  sud_ouest: [0.45, 0.5, 0.56, 0.58, 0.65, 0.75, 0.82, 0.8, 0.74, 0.6, 0.48, 0.44],
  oceanique: [0.35, 0.4, 0.48, 0.55, 0.6, 0.66, 0.72, 0.7, 0.64, 0.5, 0.38, 0.33],
  continental: [0.32, 0.4, 0.5, 0.55, 0.6, 0.68, 0.74, 0.72, 0.64, 0.5, 0.35, 0.3],
  nord: [0.3, 0.35, 0.45, 0.52, 0.58, 0.62, 0.66, 0.64, 0.58, 0.45, 0.32, 0.28],
  montagne: [0.55, 0.58, 0.55, 0.5, 0.55, 0.66, 0.74, 0.7, 0.66, 0.55, 0.45, 0.5],
};

/**
 * Satisfaction par critère, entre 0 (pas du tout) et 1 (parfait).
 * `null` = le membre n'a pas de préférence sur ce critère (il ne pèse pas dans son score).
 * Fonctions pures, volontairement simples et documentées (voir CLAUDE.md § Moteur).
 */
import type { Cadre, ComfortLevel, Envie, WeatherImportance } from './types.ts';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Dans le budget : 1. Au-delà, décroît linéairement jusqu'à 0 à +50 % du budget. */
export function budgetSatisfaction(total: number, budgetMax: number): number {
  if (budgetMax <= 0) return total <= 0 ? 1 : 0;
  if (total <= budgetMax) return 1;
  return clamp01(1 - (total - budgetMax) / (0.5 * budgetMax));
}

/**
 * Sous la limite : de 1 (trajet nul) à 0,75 (pile à la limite) — on préfère un peu plus court.
 * Au-delà : décroît jusqu'à 0 à +50 % de la limite.
 */
export function travelTimeSatisfaction(minutes: number, maxHours: number): number {
  const limit = Math.max(30, maxHours * 60);
  const r = minutes / limit;
  if (r <= 1) return 1 - 0.25 * r;
  return clamp01(0.75 * (1 - (r - 1) / 0.5));
}

/** Mode accepté : 1 ; mode non accepté (critère non indispensable) : 0,2. */
export function transportSatisfaction(accepted: boolean): number {
  return accepted ? 1 : 0.2;
}

/** Au moins un des cadres souhaités : 1 ; sinon 0,15. */
export function cadreSatisfaction(wanted: readonly Cadre[], offered: readonly Cadre[]): number | null {
  if (wanted.length === 0) return null;
  return wanted.some((c) => offered.includes(c)) ? 1 : 0.15;
}

/** Couverture moyenne des envies, pondérée par l'intensité (1 à 3) de la destination. */
export function envieSatisfaction(
  wanted: readonly Envie[],
  offered: Partial<Record<Envie, 1 | 2 | 3>>,
): number | null {
  if (wanted.length === 0) return null;
  const coverage = wanted.reduce((acc, e) => acc + (offered[e] ?? 0) / 3, 0) / wanted.length;
  return 0.1 + 0.9 * coverage;
}

/** Mieux que souhaité : légère baisse (on paie plus). Moins bien : forte baisse. */
export function comfortSatisfaction(chosen: ComfortLevel, wanted: ComfortLevel): number {
  const diff = chosen - wanted;
  if (diff === 0) return 1;
  if (diff === 1) return 0.85;
  if (diff >= 2) return 0.7;
  if (diff === -1) return 0.45;
  return 0.1;
}

/** Importance du beau temps (0–3) × probabilité de beau temps. */
export function weatherSatisfaction(importance: WeatherImportance, sunshine: number): number | null {
  if (importance === 0) return null;
  return clamp01(1 - (importance / 3) * (1 - sunshine));
}

/** Écart d'ambiance (0 = chill, 1 = intense). */
export function ambianceSatisfaction(wanted: number, offered: number): number {
  return clamp01(1 - 1.25 * Math.abs(wanted - offered));
}

/**
 * Facteur « rédhibitoire » (budget, temps de trajet) : 1 tant qu'on est dans la limite,
 * puis décroît linéairement jusqu'à `floor` à +50 % de la limite.
 */
export function dealbreakerGate(value: number, limit: number, floor: number): number {
  if (limit <= 0) return value <= 0 ? 1 : floor;
  if (value <= limit) return 1;
  const over = clamp01((value - limit) / (0.5 * limit));
  return 1 - (1 - floor) * over;
}

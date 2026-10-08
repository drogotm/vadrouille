import { COMFORT_LEVELS, type Catalog, type ComfortLevel, type Destination, type Route } from '../data/types.ts';
import type { EngineConfig } from './config.ts';
import type { Answers, CriterionKey, Importance } from './types.ts';

/** Saison d'une date ISO : 0 hiver, 1 printemps, 2 été, 3 automne. */
export function seasonIndex(isoDate: string): 0 | 1 | 2 | 3 {
  const month = Number(isoDate.slice(5, 7));
  if (month === 12 || month <= 2) return 0;
  if (month <= 5) return 1;
  if (month <= 8) return 2;
  return 3;
}

export interface ChosenRoute {
  route: Route;
  /** Le mode fait-il partie de ceux acceptés par le membre ? */
  accepted: boolean;
}

/**
 * Trajet retenu pour un membre : parmi ses modes acceptés, le moins cher qui tient dans son
 * temps de trajet max ; sinon le plus rapide de ses modes acceptés ; sinon (aucun mode
 * accepté ne dessert la destination) le meilleur trajet tous modes confondus, marqué
 * « non accepté ». `null` = destination injoignable depuis sa ville.
 */
export function chooseRoute(answers: Answers, routes: Route[]): ChosenRoute | null {
  if (routes.length === 0) return null;
  const byCost = (a: Route, b: Route) => a.cost - b.cost || a.minutes - b.minutes || a.mode.localeCompare(b.mode);
  const byTime = (a: Route, b: Route) => a.minutes - b.minutes || a.cost - b.cost || a.mode.localeCompare(b.mode);
  const maxMinutes = answers.maxTravelHours * 60;
  const best = (pool: Route[]) => {
    const inTime = pool.filter((r) => r.minutes <= maxMinutes);
    return inTime.length > 0 ? [...inTime].sort(byCost)[0] : [...pool].sort(byTime)[0];
  };
  const accepted =
    answers.transports.length === 0 ? routes : routes.filter((r) => answers.transports.includes(r.mode));
  if (accepted.length > 0) return { route: best(accepted), accepted: true };
  return { route: best(routes), accepted: false };
}

export interface MemberEvaluation {
  /** Satisfaction pondérée 0–1. */
  score: number;
  /** Critères « indispensables » violés (filtre dur). */
  violations: CriterionKey[];
  satisfaction: Partial<Record<CriterionKey, number>>;
  chosen: ChosenRoute | null;
  travelMinutes: number;
  transportCost: number;
  lodgingPerNight: number;
  lodgingCost: number;
  foodCost: number;
  activitiesCost: number;
  totalCost: number;
  withinBudget: boolean;
  withinTravelTime: boolean;
}

const importanceOf = (a: Answers, c: CriterionKey): Importance => a.importance[c] ?? 'nice';

/**
 * Évalue UNE destination, à UN niveau de confort, pour UN membre.
 * Fonction pure : mêmes entrées → même sortie.
 */
export function evaluateMember(
  answers: Answers,
  dest: Destination,
  comfort: ComfortLevel,
  weekendStart: string,
  nights: number,
  catalog: Catalog,
  config: EngineConfig,
): MemberEvaluation {
  const chosen = chooseRoute(answers, catalog.getRoutes(answers.departureCity, dest.id));
  const travelMinutes = chosen?.route.minutes ?? 0;
  const transportCost = chosen ? chosen.route.cost * 2 : 0;
  const lodgingPerNight = dest.lodging[comfort] ?? 0;
  const lodgingCost = lodgingPerNight * nights;
  const foodCost = dest.foodPerDay * nights;
  const activitiesCost = dest.activitiesPerDay * nights;
  const totalCost = Math.round(transportCost + lodgingCost + foodCost + activitiesCost);

  const sat: Partial<Record<CriterionKey, number>> = {};
  const violations: CriterionKey[] = [];
  const must = (c: CriterionKey) => importanceOf(answers, c) === 'must';

  // 💰 Budget : 1 si on tient dedans, puis décroît linéairement jusqu'à 0 à +budgetTolerance.
  const withinBudget = totalCost <= answers.budgetMax;
  if (withinBudget) sat.budget = 1;
  else if (answers.budgetMax <= 0) sat.budget = 0;
  else sat.budget = Math.max(0, 1 - (totalCost / answers.budgetMax - 1) / config.budgetTolerance);
  if (must('budget') && !withinBudget) violations.push('budget');

  // ⏱️ Temps de trajet : même logique, tolérance travelTolerance.
  const maxMinutes = answers.maxTravelHours * 60;
  const withinTravelTime = chosen !== null && travelMinutes <= maxMinutes;
  sat.travelTime = !chosen
    ? 0
    : withinTravelTime
      ? 1
      : Math.max(0, 1 - (travelMinutes / maxMinutes - 1) / config.travelTolerance);
  if (must('travelTime') && !withinTravelTime) violations.push('travelTime');

  // 🚆 Transports : un mode accepté dessert-il la destination ?
  sat.transports = chosen?.accepted ? 1 : 0;
  // injoignable = bloquant quel que soit le niveau d'importance
  if (!chosen || (must('transports') && !chosen.accepted)) violations.push('transports');

  // 🌊 Cadre : au moins un des cadres voulus (sans avis = critère ignoré).
  if (answers.cadres.length > 0) {
    sat.cadres = answers.cadres.some((c) => dest.cadres.includes(c)) ? 1 : 0;
    if (must('cadres') && sat.cadres === 0) violations.push('cadres');
  }

  // 🎯 Envies : part des envies couvertes.
  if (answers.envies.length > 0) {
    const covered = answers.envies.filter((e) => dest.envies.includes(e)).length;
    sat.envies = covered / answers.envies.length;
    if (must('envies') && covered === 0) violations.push('envies');
  }

  // 🛏️ Confort : plus confortable que voulu ne gêne pas (c'est le budget qui arbitre).
  const level = COMFORT_LEVELS.indexOf(comfort);
  sat.comfort = level >= answers.comfort ? 1 : 1 - (answers.comfort - level) / 2;
  if (must('comfort') && level < answers.comfort) violations.push('comfort');

  // ☀️ Météo : pèse d'autant plus que le beau temps compte (0 = critère ignoré).
  const sun = dest.sun[seasonIndex(weekendStart)];
  if (answers.weather > 0) {
    sat.weather = sun;
    if (must('weather') && sun < config.mustWeatherMinSun) violations.push('weather');
  }

  // 🌙 Ambiance : proximité sur l'échelle chill ↔ intense.
  const gap = Math.abs(dest.ambiance - answers.ambiance);
  sat.ambiance = 1 - gap;
  if (must('ambiance') && gap > config.mustAmbianceMaxGap) violations.push('ambiance');

  let weighted = 0;
  let totalWeight = 0;
  for (const key of Object.keys(sat) as CriterionKey[]) {
    let w = config.baseWeight[key] * config.importanceWeight[importanceOf(answers, key)];
    if (key === 'weather') w *= answers.weather / 3;
    weighted += w * (sat[key] as number);
    totalWeight += w;
  }

  return {
    score: totalWeight > 0 ? weighted / totalWeight : 0,
    violations,
    satisfaction: sat,
    chosen,
    travelMinutes,
    transportCost,
    lodgingPerNight,
    lodgingCost,
    foodCost,
    activitiesCost,
    totalCost,
    withinBudget,
    withinTravelTime,
  };
}

/** Match Score de groupe (0–1) : moyenne tempérée par le membre le moins bien servi. */
export function groupScore(scores: number[], config: EngineConfig): number {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  const min = Math.min(...scores);
  return config.fairness.mean * mean + config.fairness.min * min;
}

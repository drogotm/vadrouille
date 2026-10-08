/**
 * Évaluation d'UN membre pour UNE option (destination × niveau de confort × week-end) :
 * choix de son meilleur mode de transport, budget individuel depuis SA ville,
 * contrôle de ses critères « indispensables », satisfaction pondérée.
 */
import type { EngineConfig } from './config.ts';
import { comfortLevelFromId } from './labels.ts';
import {
  ambianceSatisfaction,
  budgetSatisfaction,
  cadreSatisfaction,
  comfortSatisfaction,
  dealbreakerGate,
  envieSatisfaction,
  transportSatisfaction,
  travelTimeSatisfaction,
  weatherSatisfaction,
} from './satisfaction.ts';
import type {
  Answers,
  Availability,
  Catalog,
  ComfortId,
  CriterionKey,
  Destination,
  Importance,
  MemberOptionDetails,
  TransportMode,
} from './types.ts';
import { TRANSPORT_MODES } from './validate.ts';

export interface EngineMember {
  id: string;
  answers: Answers;
}

export interface EvalContext {
  catalog: Catalog;
  config: EngineConfig;
  nights: number;
  month: number;
  /** critères dont on ignore le caractère « indispensable » (diagnostic « et si on assouplissait ») */
  relax?: ReadonlySet<CriterionKey>;
}

export interface MemberEvaluation {
  feasible: boolean;
  /** critères indispensables violés (vide si faisable) */
  violations: CriterionKey[];
  /** satisfaction 0–1 (après pénalité « on reste chez soi ») */
  score: number;
  /** minutes de trajet du mode retenu (0 si sur place) */
  minutes: number;
  withinTravelTime: boolean;
  details: MemberOptionDetails;
}

const EPS = 1e-9;
/** ordre de préférence à score égal : le plus sobre d'abord */
const MODE_RANK: Record<TransportMode, number> = { train: 0, bus: 1, car: 2, plane: 3 };

interface TransportOption {
  mode: TransportMode | null;
  minutes: number;
  cost: number;
  accepted: boolean;
}

function weightedScore(
  sats: Record<CriterionKey, number | null>,
  weight: (k: CriterionKey) => number,
): number {
  let num = 0;
  let den = 0;
  for (const k of Object.keys(sats) as CriterionKey[]) {
    const s = sats[k];
    if (s === null) continue;
    const w = weight(k);
    num += w * s;
    den += w;
  }
  return den === 0 ? 1 : num / den;
}

const round = (x: number) => Math.round(x);

export function evaluateMember(
  member: EngineMember,
  dest: Destination,
  comfort: ComfortId,
  availability: Availability,
  ctx: EvalContext,
): MemberEvaluation {
  const a = member.answers;
  const { config, catalog } = ctx;
  const importance = (k: CriterionKey): Importance => a.importance[k] ?? 'souhaitable';
  const isHard = (k: CriterionKey) => importance(k) === 'indispensable' && !ctx.relax?.has(k);
  const weight = (k: CriterionKey) =>
    config.criterionWeights[k] * config.importanceMultipliers[importance(k)];

  const atHome = dest.homeCity === a.departureCity;
  const lodging = ctx.nights * catalog.lodgingPerNight(dest, comfort);
  const food = ctx.nights * catalog.foodPerDay(dest, comfort);
  const activities = catalog.activities(dest, comfort);
  const stayCost = lodging + food + activities;
  const comfortLevel = comfortLevelFromId(comfort);
  const sunshine = catalog.sunshine(dest, ctx.month);
  const maxMinutes = a.maxTravelHours * 60;

  // Critères indépendants du transport
  const sCadre = cadreSatisfaction(a.cadres, dest.cadres);
  const sEnvie = envieSatisfaction(a.envies, dest.envies);
  const sComfort = comfortSatisfaction(comfortLevel, a.comfort);
  const sWeather = weatherSatisfaction(a.weather, sunshine);
  const sAmbiance = ambianceSatisfaction(a.ambiance, dest.ambiance);

  const violations = new Set<CriterionKey>();
  if (isHard('cadres') && a.cadres.length > 0 && !a.cadres.some((c) => dest.cadres.includes(c))) {
    violations.add('cadres');
  }
  // envies indispensables : au moins une envie vraiment couverte (intensité ≥ 2)
  if (isHard('envies') && a.envies.length > 0 && !a.envies.some((e) => (dest.envies[e] ?? 0) >= 2)) {
    violations.add('envies');
  }
  if (isHard('comfort') && comfortLevel < a.comfort) violations.add('comfort');
  if (isHard('weather') && a.weather >= 1 && sunshine < config.weatherHardThreshold) {
    violations.add('weather');
  }
  if (isHard('ambiance') && Math.abs(a.ambiance - dest.ambiance) > config.ambianceTolerance) {
    violations.add('ambiance');
  }

  // Options de transport depuis la ville du membre
  const accepted = a.transports.length > 0 ? a.transports : TRANSPORT_MODES;
  const options: TransportOption[] = atHome
    ? [{ mode: null, minutes: 0, cost: 0, accepted: true }]
    : TRANSPORT_MODES.flatMap((mode) => {
        const r = catalog.route(a.departureCity, dest.id, mode);
        // un trajet trop long n'est pas une option de week-end, quel que soit le mode
        if (!r || r.minutes > config.maxOneWayMinutes) return [];
        return [{ mode, minutes: r.minutes, cost: r.cost, accepted: accepted.includes(mode) }];
      });

  const passTransport = (o: TransportOption) => !isHard('transports') || o.accepted;
  const passTime = (o: TransportOption) => !isHard('travelTime') || o.minutes <= maxMinutes;
  const passBudget = (o: TransportOption) => !isHard('budget') || o.cost + stayCost <= a.budgetMax;
  const feasibleOptions = options.filter((o) => passTransport(o) && passTime(o) && passBudget(o));

  if (options.length === 0) {
    violations.add('transports');
  } else if (feasibleOptions.length === 0) {
    // Quel(s) critère(s) éliminent toutes les options ? (pour le diagnostic, sans dire qui)
    const before = violations.size;
    if (!options.some(passTransport)) violations.add('transports');
    else if (!options.some((o) => passTransport(o) && passTime(o))) violations.add('travelTime');
    else violations.add('budget');
    if (violations.size === before) violations.add('budget');
  }

  // Meilleur mode pour ce membre (parmi les faisables, sinon tous — pour afficher ses chiffres)
  const pool = feasibleOptions.length > 0 ? feasibleOptions : options;
  let best: { option: TransportOption; score: number } | null = null;
  for (const o of pool) {
    const sats: Record<CriterionKey, number | null> = {
      budget: budgetSatisfaction(o.cost + stayCost, a.budgetMax),
      travelTime: travelTimeSatisfaction(o.minutes, a.maxTravelHours),
      transports: atHome ? null : transportSatisfaction(o.accepted),
      cadres: sCadre,
      envies: sEnvie,
      comfort: sComfort,
      weather: sWeather,
      ambiance: sAmbiance,
    };
    // budget et trajet « rédhibitoires » : un gros dépassement fait chuter toute la satisfaction
    const floor = (k: 'budget' | 'travelTime') =>
      importance(k) === 'negociable' ? config.dealbreakerFloor.negociable : config.dealbreakerFloor.souhaitable;
    const gate =
      dealbreakerGate(o.cost + stayCost, a.budgetMax, floor('budget')) *
      dealbreakerGate(o.minutes, maxMinutes, floor('travelTime'));
    const score = weightedScore(sats, weight) * gate;
    const better =
      !best ||
      score > best.score + EPS ||
      (Math.abs(score - best.score) <= EPS &&
        o.mode !== null &&
        best.option.mode !== null &&
        MODE_RANK[o.mode] < MODE_RANK[best.option.mode]);
    if (better) best = { option: o, score };
  }

  const chosen = best?.option ?? { mode: null, minutes: 0, cost: 0, accepted: false };
  let score = best?.score ?? 0;
  if (atHome) score *= config.homePenalty;

  // montants arrondis à l'euro : le détail affiché s'additionne exactement au total
  const parts = {
    transport: round(chosen.cost),
    lodging: round(lodging),
    food: round(food),
    activities: round(activities),
  };
  const total = parts.transport + parts.lodging + parts.food + parts.activities;

  return {
    feasible: violations.size === 0,
    violations: [...violations],
    score,
    minutes: chosen.minutes,
    withinTravelTime: chosen.minutes <= maxMinutes,
    details: {
      availability,
      transport:
        chosen.mode === null ? null : { mode: chosen.mode, minutes: chosen.minutes, cost: parts.transport },
      lodging: parts.lodging,
      food: parts.food,
      activities: parts.activities,
      total,
      budgetMax: a.budgetMax,
      withinBudget: total <= a.budgetMax,
      score: Math.round(score * 100),
    },
  };
}

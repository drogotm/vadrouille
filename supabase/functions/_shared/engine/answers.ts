import { CADRES, ENVIES, TRANSPORT_MODES } from '../data/types.ts';
import { CRITERIA, type Answers, type Availability, type CriterionKey, type Importance } from './types.ts';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(v) ? allowed.filter((a) => v.includes(a)) : [];

/** Réponses par défaut d'un questionnaire vierge. */
export function defaultAnswers(weekends: string[]): Answers {
  return {
    version: 1,
    availability: Object.fromEntries(weekends.map((w) => [w, 'yes' as Availability])),
    departureCity: 'paris',
    budgetMax: 300,
    maxTravelHours: 4,
    transports: ['train', 'car'],
    cadres: [],
    envies: [],
    comfort: 1,
    weather: 2,
    ambiance: 0.5,
    importance: {},
  };
}

/**
 * Remet des réponses brutes (JSON venu de la base) dans un format sûr pour le moteur.
 * Tolérant : une valeur absurde est ramenée dans les bornes plutôt que de faire échouer le calcul.
 */
export function normalizeAnswers(raw: unknown, weekends: string[]): Answers {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawAvail = (r.availability && typeof r.availability === 'object' ? r.availability : {}) as Record<
    string,
    unknown
  >;
  const availability: Record<string, Availability> = {};
  for (const w of weekends) {
    const v = rawAvail[w];
    // une dispo non renseignée est traitée comme « pas dispo » (on ne suppose pas la présence)
    availability[w] = v === 'yes' || v === 'maybe' ? v : 'no';
  }
  const rawImp = (r.importance && typeof r.importance === 'object' ? r.importance : {}) as Record<
    string,
    unknown
  >;
  const importance: Partial<Record<CriterionKey, Importance>> = {};
  for (const c of CRITERIA) {
    const v = rawImp[c];
    if (v === 'must' || v === 'flex') importance[c] = v;
  }
  return {
    version: 1,
    availability,
    departureCity: typeof r.departureCity === 'string' ? r.departureCity : '',
    budgetMax: clamp(num(r.budgetMax, 300), 0, 10000),
    maxTravelHours: clamp(num(r.maxTravelHours, 4), 0.5, 24),
    transports: pick(r.transports, TRANSPORT_MODES),
    cadres: pick(r.cadres, CADRES),
    envies: pick(r.envies, ENVIES),
    comfort: clamp(Math.round(num(r.comfort, 1)), 0, 2),
    weather: clamp(Math.round(num(r.weather, 2)), 0, 3),
    ambiance: clamp(num(r.ambiance, 0.5), 0, 1),
    importance,
  };
}

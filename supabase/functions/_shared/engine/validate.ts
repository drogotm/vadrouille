/** Validation / normalisation des réponses brutes (jamais confiance au client). */
import type {
  Answers,
  Availability,
  Cadre,
  CityId,
  ComfortLevel,
  CriterionKey,
  Envie,
  Importance,
  TransportMode,
  WeatherImportance,
} from './types.ts';

export const CITY_IDS: readonly CityId[] = [
  'paris', 'lyon', 'marseille', 'bordeaux', 'lille', 'nantes', 'toulouse', 'strasbourg',
  'montpellier', 'nice', 'rennes', 'grenoble',
];
export const TRANSPORT_MODES: readonly TransportMode[] = ['train', 'car', 'bus', 'plane'];
export const CADRES: readonly Cadre[] = ['mer', 'montagne', 'campagne', 'ville'];
export const ENVIES: readonly Envie[] = ['sport', 'fete', 'culture', 'gastronomie', 'nature', 'bien_etre'];
export const CRITERIA: readonly CriterionKey[] = [
  'budget', 'travelTime', 'transports', 'cadres', 'envies', 'comfort', 'weather', 'ambiance',
];
const IMPORTANCES: readonly Importance[] = ['indispensable', 'souhaitable', 'negociable'];
const AVAILABILITIES: readonly Availability[] = ['yes', 'maybe', 'no'];

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function num(x: unknown, min: number, max: number): number | null {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}

function pick<T extends string>(list: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(list)) return [];
  const out: T[] = [];
  for (const v of list) if (allowed.includes(v as T) && !out.includes(v as T)) out.push(v as T);
  return out;
}

/**
 * Renvoie des réponses normalisées, ou null si inexploitables.
 * Une dispo manquante pour un week-end candidat est traitée comme « peut-être ».
 */
export function parseAnswers(raw: unknown, weekends: readonly string[]): Answers | null {
  if (!isObject(raw)) return null;
  const departureCity = raw.departureCity as CityId;
  if (!CITY_IDS.includes(departureCity)) return null;
  const budgetMax = num(raw.budgetMax, 0, 10_000);
  const maxTravelHours = num(raw.maxTravelHours, 0.5, 24);
  const comfort = num(raw.comfort, 0, 2);
  const weather = num(raw.weather, 0, 3);
  const ambiance = num(raw.ambiance, 0, 1);
  if (budgetMax === null || maxTravelHours === null || comfort === null || weather === null || ambiance === null) {
    return null;
  }

  const rawAvailability = isObject(raw.availability) ? raw.availability : {};
  const availability: Record<string, Availability> = {};
  for (const w of weekends) {
    const v = rawAvailability[w] as Availability;
    availability[w] = AVAILABILITIES.includes(v) ? v : 'maybe';
  }

  const importance: Partial<Record<CriterionKey, Importance>> = {};
  if (isObject(raw.importance)) {
    for (const k of CRITERIA) {
      const v = raw.importance[k] as Importance;
      if (IMPORTANCES.includes(v)) importance[k] = v;
    }
  }

  return {
    version: 1,
    availability,
    departureCity,
    budgetMax,
    maxTravelHours,
    transports: pick(raw.transports, TRANSPORT_MODES),
    cadres: pick(raw.cadres, CADRES),
    envies: pick(raw.envies, ENVIES),
    comfort: Math.round(comfort) as ComfortLevel,
    weather: Math.round(weather) as WeatherImportance,
    ambiance,
    importance,
  };
}

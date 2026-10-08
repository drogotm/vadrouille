/**
 * Potes fictifs : alimentent le mode démo et le test de bout en bout (groupe de 5).
 * TypeScript pur (aucune dépendance React Native).
 */
import type { Answers, Availability } from '../../../supabase/functions/_shared/engine/types.ts';

export interface Persona {
  firstName: string;
  answers: (weekends: readonly string[]) => Answers;
}

function availability(weekends: readonly string[], pattern: Availability[]): Record<string, Availability> {
  return Object.fromEntries(weekends.map((w, i) => [w, pattern[i % pattern.length]]));
}

export const PERSONAS: readonly Persona[] = [
  {
    firstName: 'Léa',
    answers: (w) => ({
      version: 1,
      availability: availability(w, ['yes', 'yes', 'maybe', 'yes']),
      departureCity: 'paris',
      budgetMax: 320,
      maxTravelHours: 4,
      transports: ['train'],
      cadres: ['mer', 'ville'],
      envies: ['gastronomie', 'fete'],
      comfort: 1,
      weather: 2,
      ambiance: 0.6,
      importance: {},
    }),
  },
  {
    firstName: 'Max',
    answers: (w) => ({
      version: 1,
      availability: availability(w, ['yes', 'no', 'yes', 'yes']),
      departureCity: 'lyon',
      budgetMax: 230,
      maxTravelHours: 4.5,
      transports: ['train', 'car'],
      cadres: ['montagne', 'ville'],
      envies: ['sport', 'fete'],
      comfort: 0,
      weather: 1,
      ambiance: 0.8,
      importance: { budget: 'indispensable' },
    }),
  },
  {
    firstName: 'Inès',
    answers: (w) => ({
      version: 1,
      availability: availability(w, ['yes', 'yes', 'yes', 'maybe']),
      departureCity: 'bordeaux',
      budgetMax: 420,
      maxTravelHours: 5,
      transports: ['train', 'plane'],
      cadres: ['mer'],
      envies: ['bien_etre', 'gastronomie'],
      comfort: 2,
      weather: 3,
      ambiance: 0.3,
      importance: { comfort: 'negociable' },
    }),
  },
  {
    firstName: 'Hugo',
    answers: (w) => ({
      version: 1,
      availability: availability(w, ['maybe', 'yes', 'yes', 'yes']),
      departureCity: 'lille',
      budgetMax: 270,
      maxTravelHours: 5,
      transports: ['train', 'bus'],
      cadres: ['ville'],
      envies: ['fete', 'culture'],
      comfort: 0,
      weather: 0,
      ambiance: 0.9,
      importance: {},
    }),
  },
  {
    firstName: 'Sarah',
    answers: (w) => ({
      version: 1,
      availability: availability(w, ['yes', 'yes', 'no', 'yes']),
      departureCity: 'marseille',
      budgetMax: 360,
      maxTravelHours: 5,
      transports: ['car', 'train'],
      cadres: ['mer', 'montagne'],
      envies: ['nature', 'sport', 'gastronomie'],
      comfort: 1,
      weather: 2,
      ambiance: 0.4,
      importance: { travelTime: 'negociable' },
    }),
  },
  {
    firstName: 'Tom',
    answers: (w) => ({
      version: 1,
      availability: availability(w, ['yes', 'maybe', 'yes', 'yes']),
      departureCity: 'paris',
      budgetMax: 280,
      maxTravelHours: 4,
      transports: ['train', 'bus'],
      cadres: ['mer', 'campagne'],
      envies: ['nature', 'gastronomie'],
      comfort: 1,
      weather: 1,
      ambiance: 0.5,
      importance: {},
    }),
  },
];

/** Réponses « type » pour l'utilisateur de la démo (s'il ne remplit pas lui-même). */
export function defaultAnswers(weekends: readonly string[]): Answers {
  return {
    version: 1,
    availability: availability(weekends, ['yes', 'yes', 'maybe', 'yes']),
    departureCity: 'paris',
    budgetMax: 300,
    maxTravelHours: 4,
    transports: ['train', 'car'],
    cadres: ['mer', 'ville'],
    envies: ['gastronomie', 'fete', 'culture'],
    comfort: 1,
    weather: 2,
    ambiance: 0.55,
    importance: {},
  };
}

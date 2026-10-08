import type { Catalog, Destination } from '../../supabase/functions/_shared/data/index.ts';
import { buildCatalog, CITIES } from '../../supabase/functions/_shared/data/index.ts';
import type { Answers, EngineInput, EngineMember } from '../../supabase/functions/_shared/engine/index.ts';

export const WEEKENDS = ['2027-05-14', '2027-05-21', '2027-06-04'];

export function answers(overrides: Partial<Answers> = {}): Answers {
  return {
    version: 1,
    availability: Object.fromEntries(WEEKENDS.map((w) => [w, 'yes' as const])),
    departureCity: 'paris',
    budgetMax: 350,
    maxTravelHours: 4,
    transports: ['train', 'car'],
    cadres: ['ville'],
    envies: ['gastronomie'],
    comfort: 1,
    weather: 2,
    ambiance: 0.5,
    importance: {},
    ...overrides,
  };
}

export const member = (userId: string, overrides: Partial<Answers> = {}): EngineMember => ({
  userId,
  answers: answers(overrides),
});

export const input = (members: EngineMember[], overrides: Partial<EngineInput> = {}): EngineInput => ({
  weekends: WEEKENDS,
  nights: 2,
  members,
  ...overrides,
});

/** La bande de 7 du brief : budgets, villes et envies variés. */
export const BANDE_DE_7: EngineMember[] = [
  member('u-lea', { departureCity: 'paris', budgetMax: 350, envies: ['gastronomie', 'fete'], cadres: ['ville', 'mer'] }),
  member('u-max', { departureCity: 'paris', budgetMax: 280, envies: ['gastronomie', 'fete'], cadres: ['ville'] }),
  member('u-ines', { departureCity: 'lyon', budgetMax: 400, envies: ['gastronomie', 'culture'], cadres: ['ville'], maxTravelHours: 5 }),
  member('u-tom', { departureCity: 'nantes', budgetMax: 300, envies: ['fete', 'sport'], cadres: ['mer', 'ville'], maxTravelHours: 5 }),
  member('u-sarah', { departureCity: 'paris', budgetMax: 500, envies: ['gastronomie', 'bienetre'], cadres: ['mer'], comfort: 2 }),
  member('u-hugo', { departureCity: 'toulouse', budgetMax: 260, envies: ['gastronomie', 'fete'], cadres: ['ville'], comfort: 0 }),
  member('u-jade', { departureCity: 'bordeaux', budgetMax: 320, envies: ['gastronomie', 'nature'], cadres: ['ville', 'campagne'] }),
];

/** Destination minimale pour des catalogues de test maîtrisés. */
export function dest(id: string, overrides: Partial<Destination> = {}): Destination {
  return {
    id,
    name: id,
    country: 'France',
    emoji: '📍',
    tagline: '',
    lat: 47,
    lon: 2,
    cadres: ['ville'],
    envies: ['gastronomie'],
    ambiance: 0.5,
    popularity: 50,
    rail: 'tgv',
    airport: false,
    bus: true,
    lodging: { confortable: 50 },
    foodPerDay: 30,
    activitiesPerDay: 10,
    sun: [0.5, 0.5, 0.5, 0.5],
    activities: [],
    restos: [],
    ...overrides,
  };
}

export const miniCatalog = (destinations: Destination[]): Catalog => buildCatalog(CITIES, destinations);

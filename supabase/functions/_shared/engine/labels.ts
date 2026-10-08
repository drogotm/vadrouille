import type { Cadre, ComfortLevel, Envie, TransportMode } from '../data/types.ts';
import type { CriterionKey, OptionKind } from './types.ts';

/** « 2h08 », « 45 min » */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

/** Complément de « k/n voulaient … » */
export const ENVIE_WANT: Record<Envie, string> = {
  sport: 'du sport',
  fete: 'sortir',
  culture: 'de la culture',
  gastronomie: 'bien manger',
  nature: 'de la nature',
  bienetre: 'du bien-être',
};

export const CADRE_WANT: Record<Cadre, string> = {
  mer: 'la mer',
  montagne: 'la montagne',
  campagne: 'la campagne',
  ville: 'la ville',
};

export const ENVIE_LABEL: Record<Envie, string> = {
  sport: 'Sport',
  fete: 'Fête',
  culture: 'Culture',
  gastronomie: 'Gastronomie',
  nature: 'Nature',
  bienetre: 'Bien-être',
};

export const CADRE_LABEL: Record<Cadre, string> = {
  mer: 'Mer',
  montagne: 'Montagne',
  campagne: 'Campagne',
  ville: 'Ville',
};

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  train: 'Train',
  car: 'Voiture',
  plane: 'Avion',
  bus: 'Bus',
};

export const COMFORT_LABEL: Record<ComfortLevel, string> = {
  roots: 'Roots',
  confortable: 'Confortable',
  premium: 'Premium',
};

export const KIND_LABEL: Record<OptionKind, string> = {
  best: 'Best Match',
  budget: 'Budget Match',
  wild: 'Wild Card',
};

export const KIND_EMOJI: Record<OptionKind, string> = { best: '🥇', budget: '💸', wild: '🔥' };

/** Nom du critère dans une phrase (« … bloque : le budget »). */
export const CRITERION_LABEL: Record<CriterionKey, string> = {
  budget: 'le budget',
  travelTime: 'le temps de trajet',
  transports: 'les transports acceptés',
  cadres: 'le cadre',
  envies: 'les envies',
  comfort: 'le confort',
  weather: 'la météo',
  ambiance: 'l’ambiance',
};

export const CRITERION_SUGGESTION: Record<CriterionKey, string> = {
  budget: 'Monter un peu le budget max, ou le passer de « indispensable » à « souhaitable ».',
  travelTime: 'Accepter un trajet un peu plus long, ou passer ce critère en « souhaitable ».',
  transports: 'Accepter un mode de transport de plus (train, voiture, bus ou avion).',
  cadres: 'Élargir les cadres acceptés, ou passer ce critère en « souhaitable ».',
  envies: 'Passer les envies en « souhaitable » plutôt qu’« indispensable ».',
  comfort: 'Accepter un niveau de confort en dessous, ou passer ce critère en « souhaitable ».',
  weather: 'Passer la météo en « souhaitable » (ou viser un week-end plus ensoleillé).',
  ambiance: 'Passer l’ambiance en « souhaitable ».',
};

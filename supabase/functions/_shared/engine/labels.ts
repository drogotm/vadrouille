/** Libellés français partagés (UI + explications du moteur). */
import type {
  Cadre,
  CityId,
  ComfortId,
  CriterionKey,
  Envie,
  Importance,
  TransportMode,
} from './types.ts';

export const CITY_LABELS: Record<CityId, string> = {
  paris: 'Paris',
  lyon: 'Lyon',
  marseille: 'Marseille',
  bordeaux: 'Bordeaux',
  lille: 'Lille',
  nantes: 'Nantes',
  toulouse: 'Toulouse',
  strasbourg: 'Strasbourg',
  montpellier: 'Montpellier',
  nice: 'Nice',
  rennes: 'Rennes',
  grenoble: 'Grenoble',
};

export const TRANSPORT_LABELS: Record<TransportMode, { label: string; emoji: string }> = {
  train: { label: 'Train', emoji: '🚆' },
  car: { label: 'Voiture', emoji: '🚗' },
  plane: { label: 'Avion', emoji: '✈️' },
  bus: { label: 'Bus', emoji: '🚌' },
};

export const CADRE_LABELS: Record<Cadre, { label: string; emoji: string; wanted: string }> = {
  mer: { label: 'Mer', emoji: '🌊', wanted: 'voulaient la mer' },
  montagne: { label: 'Montagne', emoji: '🏔️', wanted: 'voulaient la montagne' },
  campagne: { label: 'Campagne', emoji: '🌾', wanted: 'voulaient la campagne' },
  ville: { label: 'Ville', emoji: '🏙️', wanted: 'voulaient la ville' },
};

export const ENVIE_LABELS: Record<Envie, { label: string; emoji: string; wanted: string }> = {
  sport: { label: 'Sport', emoji: '🏄', wanted: 'voulaient du sport' },
  fete: { label: 'Fête', emoji: '🎉', wanted: 'voulaient sortir' },
  culture: { label: 'Culture', emoji: '🏛️', wanted: 'voulaient de la culture' },
  gastronomie: { label: 'Gastronomie', emoji: '🍷', wanted: 'voulaient gastronomie' },
  nature: { label: 'Nature', emoji: '🌲', wanted: 'voulaient de la nature' },
  bien_etre: { label: 'Bien-être', emoji: '🧖', wanted: 'voulaient du bien-être' },
};

export const COMFORT_LABELS: Record<ComfortId, { label: string; emoji: string; description: string }> = {
  roots: { label: 'Roots', emoji: '⛺', description: 'Auberge, camping, canapé-lit : on s’en fiche' },
  confortable: { label: 'Confortable', emoji: '🛏️', description: 'Un appart ou un hôtel sympa' },
  premium: { label: 'Premium', emoji: '✨', description: 'Belle maison, spa : on se fait plaisir' },
};

export const WEATHER_LABELS: { label: string; emoji: string }[] = [
  { label: 'Peu importe', emoji: '🌦️' },
  { label: 'Ce serait cool', emoji: '🌤️' },
  { label: 'Important', emoji: '☀️' },
  { label: 'Grand soleil obligé', emoji: '😎' },
];

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  budget: 'Budget',
  travelTime: 'Temps de trajet',
  transports: 'Transports',
  cadres: 'Cadre',
  envies: 'Envies',
  comfort: 'Confort',
  weather: 'Météo',
  ambiance: 'Ambiance',
};

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  indispensable: 'Indispensable',
  souhaitable: 'Souhaitable',
  negociable: 'Négociable',
};

export function ambianceLabel(value: number): string {
  if (value < 0.2) return 'Très chill';
  if (value < 0.4) return 'Plutôt chill';
  if (value <= 0.6) return 'Un peu des deux';
  if (value <= 0.8) return 'Plutôt intense';
  return 'À fond';
}

export function comfortIdFromLevel(level: number): ComfortId {
  return level <= 0 ? 'roots' : level >= 2 ? 'premium' : 'confortable';
}

export function comfortLevelFromId(id: ComfortId): 0 | 1 | 2 {
  return id === 'roots' ? 0 : id === 'premium' ? 2 : 1;
}

/** « 2h08 », « 45 min » */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h${r.toString().padStart(2, '0')}`;
}

/** « 247 € » (espace insécable fine avant €) */
export function formatEuros(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} €`;
}

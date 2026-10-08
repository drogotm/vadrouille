/**
 * Types des données « catalogue » (destinations, villes, trajets).
 * Le moteur ne dépend que de l'interface `Catalog` : pour brancher des sources réelles
 * (prix trains, hébergements…), il suffit de fournir un autre `Catalog`.
 */

export type TransportMode = 'train' | 'car' | 'plane' | 'bus';
export type Cadre = 'mer' | 'montagne' | 'campagne' | 'ville';
export type Envie = 'sport' | 'fete' | 'culture' | 'gastronomie' | 'nature' | 'bienetre';
export type ComfortLevel = 'roots' | 'confortable' | 'premium';

export const TRANSPORT_MODES: TransportMode[] = ['train', 'car', 'plane', 'bus'];
export const CADRES: Cadre[] = ['mer', 'montagne', 'campagne', 'ville'];
export const ENVIES: Envie[] = ['sport', 'fete', 'culture', 'gastronomie', 'nature', 'bienetre'];
export const COMFORT_LEVELS: ComfortLevel[] = ['roots', 'confortable', 'premium'];

export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  emoji: string;
  /** Accroche courte affichée sur la carte résultat. */
  tagline: string;
  lat: number;
  lon: number;
  cadres: Cadre[];
  envies: Envie[];
  /** 0 = très chill, 1 = très intense. */
  ambiance: number;
  /** 0–100 : notoriété « week-end entre potes ». Sert à la Wild Card (moins connu = plus original). */
  popularity: number;
  /** Desserte ferroviaire : grande vitesse, classique, ou aucune gare pratique. */
  rail: 'tgv' | 'ter' | null;
  airport: boolean;
  bus: boolean;
  /** € par nuit et par personne, ESTIMÉ. Un niveau absent = non disponible sur place. */
  lodging: Partial<Record<ComfortLevel, number>>;
  /** € par jour et par personne, ESTIMÉ. */
  foodPerDay: number;
  /** € par jour et par personne, ESTIMÉ. */
  activitiesPerDay: number;
  /** Probabilité de beau temps par saison [hiver, printemps, été, automne], 0–1. */
  sun: [number, number, number, number];
  activities: string[];
  restos: string[];
}

export interface Route {
  mode: TransportMode;
  /** Durée porte-à-porte d'un aller, en minutes. ESTIMÉ. */
  minutes: number;
  /** Coût d'un ALLER par personne, en €. ESTIMÉ. */
  cost: number;
  /** D'où vient la valeur : modèle de distance, valeur saisie à la main, ou API (plus tard). */
  source: 'model' | 'manual' | 'api';
}

export interface Catalog {
  cities: City[];
  destinations: Destination[];
  /** Trajets possibles entre une ville de départ et une destination (vide = injoignable). */
  getRoutes(cityId: string, destinationId: string): Route[];
}

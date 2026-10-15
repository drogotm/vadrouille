/**
 * Vocabulaire partagé : app (React Native / web), Edge Function (Deno) et tests (Node).
 * TypeScript pur, aucune dépendance. Imports relatifs avec extension `.ts` (Deno).
 */

export const ENGINE_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Questionnaire
// ---------------------------------------------------------------------------

export type CityId =
  | 'paris'
  | 'lyon'
  | 'marseille'
  | 'bordeaux'
  | 'lille'
  | 'nantes'
  | 'toulouse'
  | 'strasbourg'
  | 'montpellier'
  | 'nice'
  | 'rennes'
  | 'grenoble';

export type TransportMode = 'train' | 'car' | 'plane' | 'bus';
export type Cadre = 'mer' | 'montagne' | 'campagne' | 'ville';
export type Envie = 'sport' | 'fete' | 'culture' | 'gastronomie' | 'nature' | 'bien_etre';

/** 0 = roots, 1 = confortable, 2 = premium */
export type ComfortLevel = 0 | 1 | 2;
export type ComfortId = 'roots' | 'confortable' | 'premium';
export const COMFORT_IDS: readonly ComfortId[] = ['roots', 'confortable', 'premium'];

export type Availability = 'yes' | 'maybe' | 'no';

/** Niveau d'importance d'un critère. Par défaut : souhaitable. */
export type Importance = 'indispensable' | 'souhaitable' | 'negociable';

export type CriterionKey =
  | 'budget'
  | 'travelTime'
  | 'transports'
  | 'cadres'
  | 'envies'
  | 'comfort'
  | 'weather'
  | 'ambiance';

/** Importance du beau temps : 0 peu importe → 3 grand soleil obligé. */
export type WeatherImportance = 0 | 1 | 2 | 3;

/** Réponses d'un membre (forme stockée dans `responses.answers`). PRIVÉES. */
export interface Answers {
  version: 1;
  /** clé = vendredi (ISO) du week-end candidat */
  availability: Record<string, Availability>;
  departureCity: CityId;
  /** budget max all-in par personne (€) */
  budgetMax: number;
  /** temps de trajet max, aller simple (heures) */
  maxTravelHours: number;
  /** transports acceptés ; vide = tous */
  transports: TransportMode[];
  /** cadres souhaités ; vide = peu importe */
  cadres: Cadre[];
  /** envies ; vide = peu importe */
  envies: Envie[];
  comfort: ComfortLevel;
  weather: WeatherImportance;
  /** 0 = chill → 1 = intense */
  ambiance: number;
  importance: Partial<Record<CriterionKey, Importance>>;
}

// ---------------------------------------------------------------------------
// Données destinations (seed)
// ---------------------------------------------------------------------------

export type ClimateZone =
  | 'mediterraneen'
  | 'sud_ouest'
  | 'oceanique'
  | 'nord'
  | 'continental'
  | 'montagne'
  | 'iberique';

export interface Suggestion {
  name: string;
  description: string;
  envie?: Envie;
  price?: '€' | '€€' | '€€€';
}

export interface Destination {
  id: string;
  name: string;
  region: string;
  country: string;
  emoji: string;
  /** dégradé de la carte destination */
  colors: [string, string];
  lat: number;
  lng: number;
  cadres: Cadre[];
  /** intensité de chaque envie couverte (1 = un peu, 3 = c'est LE spot) */
  envies: Partial<Record<Envie, 1 | 2 | 3>>;
  /** 0 = chill → 1 = intense */
  ambiance: number;
  /** 1 = confidentiel → 5 = incontournable (sert à la Wild Card) */
  popularity: 1 | 2 | 3 | 4 | 5;
  climate: ClimateZone;
  /** multiplicateur de coût de la vie (logement, repas), 1 = moyenne */
  costIndex: number;
  /** budget activités estimé par personne pour le week-end (€) */
  activityCost: number;
  /** si la destination est aussi une ville de départ couverte */
  homeCity?: CityId;
  pitch: string;
  activities: Suggestion[];
  restaurants: Suggestion[];
}

export interface DepartureCity {
  id: CityId;
  name: string;
  lat: number;
  lng: number;
}

/** Estimation d'un trajet : durée aller simple (min) et coût aller-retour par personne (€). */
export interface RouteEstimate {
  minutes: number;
  cost: number;
}

/**
 * Source de données du moteur. Le seed implémente cette interface ; des sources réelles
 * (prix trains, hébergements…) pourront l'implémenter sans toucher au moteur.
 */
export interface Catalog {
  destinations: readonly Destination[];
  cities: readonly DepartureCity[];
  route(from: CityId, destinationId: string, mode: TransportMode): RouteEstimate | null;
  lodgingPerNight(destination: Destination, comfort: ComfortId): number;
  foodPerDay(destination: Destination, comfort: ComfortId): number;
  activities(destination: Destination, comfort: ComfortId): number;
  /** probabilité de beau temps (0–1) pour le mois donné (1–12) */
  sunshine(destination: Destination, month: number): number;
}

// ---------------------------------------------------------------------------
// Sorties du moteur
// ---------------------------------------------------------------------------

export type OptionKind = 'best' | 'budget' | 'wild';

export type DecisionStatus = 'ok' | 'no_feasible' | 'no_weekend' | 'not_enough_answers';

/** Données PUBLIQUES d'une option (vues par tous les membres) — uniquement des agrégats filtrés. */
export interface OptionPublicData {
  /** « Bordeaux — 92 % Match » */
  headline: string;
  /** ligne de chiffres : « 247 €/personne en moyenne · 2h08 de trajet moyen » (null si masquée) */
  statsLine: string | null;
  /** agrégats : « 7/7 respectent leur budget », « 6/7 voulaient gastronomie »… */
  highlights: string[];
  /** accroche (template, ou rédigée par Claude côté serveur) */
  pitch: string;
  pitchByLlm?: boolean;
  avgCost: number | null;
  avgTravelMinutes: number | null;
  /** probabilité estimée de beau temps (0–1) — donnée destination, pas une réponse */
  sunshine: number;
  /** phrase sur la présence ce week-end (« Tout le monde est dispo ») */
  presence: string;
  nights: number;
  /** une ligne qui dit pourquoi cette option (Best/Budget/Wild) */
  reason: string;
  suggestions: { activities: Suggestion[]; restaurants: Suggestion[] };
  /** programme rédigé (optionnel, LLM) */
  program?: string[];
}

/** Détails INDIVIDUELS d'une option pour un membre — privés (RLS). */
export interface MemberOptionDetails {
  availability: Availability;
  /** null = sur place (destination = sa ville) */
  transport: { mode: TransportMode; minutes: number; cost: number } | null;
  lodging: number;
  food: number;
  activities: number;
  total: number;
  budgetMax: number;
  withinBudget: boolean;
  /** satisfaction individuelle 0–100 */
  score: number;
}

export interface EngineOption {
  kind: OptionKind;
  position: 1 | 2 | 3;
  destinationId: string;
  weekendStart: string;
  comfort: ComfortId;
  matchScore: number;
  publicData: OptionPublicData;
  memberDetails: { memberId: string; details: MemberOptionDetails }[];
}

export interface BlockingCriterion {
  criterion: CriterionKey | 'availability' | 'combination' | 'unreachable';
  /** nombre de destinations qui redeviennent possibles si on assouplit ce critère */
  unlocks: number;
  message: string;
  suggestion: string;
}

/** Résumé PUBLIC du calcul (stocké dans results.summary). */
export interface PublicSummary {
  respondents: number;
  totalMembers: number;
  weekend: { start: string; presence: string } | null;
  /** vrai si des agrégats ont été masqués (groupe sous le seuil) */
  aggregatesHidden: boolean;
  privacyThreshold: number;
  blocking: BlockingCriterion[];
  /** message principal en cas d'échec */
  message?: string;
}

export interface DecisionResult {
  status: DecisionStatus;
  engineVersion: string;
  respondents: number;
  weekendStart: string | null;
  summary: PublicSummary;
  options: EngineOption[];
}

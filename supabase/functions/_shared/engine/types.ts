import type { Cadre, ComfortLevel, Envie, TransportMode } from '../data/types.ts';

export type Importance = 'must' | 'nice' | 'flex';
export type Availability = 'yes' | 'no' | 'maybe';

/** Critères pondérables du questionnaire (dispos et ville de départ ne le sont pas). */
export type CriterionKey =
  | 'budget'
  | 'travelTime'
  | 'transports'
  | 'cadres'
  | 'envies'
  | 'comfort'
  | 'weather'
  | 'ambiance';

export const CRITERIA: CriterionKey[] = [
  'budget',
  'travelTime',
  'transports',
  'cadres',
  'envies',
  'comfort',
  'weather',
  'ambiance',
];

/** Réponses d'un membre, telles que stockées dans `responses.answers` (PRIVÉ). */
export interface Answers {
  version: 1;
  /** Clé = vendredi du week-end candidat (YYYY-MM-DD). */
  availability: Record<string, Availability>;
  departureCity: string;
  /** Budget max all-in, en €. */
  budgetMax: number;
  maxTravelHours: number;
  transports: TransportMode[];
  cadres: Cadre[];
  envies: Envie[];
  /** 0 = roots, 1 = confortable, 2 = premium. */
  comfort: number;
  /** Importance du beau temps : 0 = peu importe … 3 = essentiel. */
  weather: number;
  /** 0 = chill … 1 = intense. */
  ambiance: number;
  /** Absent = « souhaitable ». */
  importance: Partial<Record<CriterionKey, Importance>>;
}

export interface EngineMember {
  userId: string;
  answers: Answers;
}

export interface EngineInput {
  /** Vendredis candidats (YYYY-MM-DD). */
  weekends: string[];
  nights: number;
  /** Uniquement les membres ayant répondu. */
  members: EngineMember[];
}

export type ResultStatus = 'ok' | 'no_feasible' | 'no_weekend' | 'not_enough_answers';
export type OptionKind = 'best' | 'budget' | 'wild';

export interface PublicAggregate {
  key: string;
  count: number;
  total: number;
  label: string;
}

/** Données PUBLIQUES d'une option : uniquement des agrégats déjà filtrés. */
export interface OptionPublicData {
  destinationName: string;
  country: string;
  emoji: string;
  tagline: string;
  cadres: Cadre[];
  envies: Envie[];
  nights: number;
  /** Pourquoi cette option occupe cette place (Best / Budget / Wild). */
  kindReason: string;
  /** « Bordeaux — 92 % Match » */
  headline: string;
  /** Coût moyen par personne, en € (arrondi à 10 € sous le seuil de confidentialité). */
  avgCost: number;
  avgTravelMinutes: number;
  /** « 247 €/personne en moyenne · 2h08 de trajet moyen » */
  statsLine: string;
  /** Lignes d'explication prêtes à afficher. */
  lines: string[];
  aggregates: PublicAggregate[];
  activities: string[];
  restos: string[];
  /** Phrase d'accroche rédigée par le LLM à partir des agrégats (optionnelle). */
  pitch: string | null;
  estimated: true;
}

/** Détail PRIVÉ d'un membre pour une option (lisible uniquement par lui). */
export interface MemberDetails {
  present: boolean;
  transport: {
    mode: TransportMode;
    minutes: number;
    costRoundTrip: number;
    /** false si aucun mode accepté par le membre ne dessert la destination. */
    accepted: boolean;
  } | null;
  lodging: { comfort: ComfortLevel; perNight: number; nights: number; total: number };
  food: number;
  activities: number;
  total: number;
  budgetMax: number;
  withinBudget: boolean;
  /** Satisfaction individuelle 0–100. */
  score: number;
}

export interface EngineOption {
  kind: OptionKind;
  position: number;
  destinationId: string;
  weekendStart: string;
  comfort: ComfortLevel;
  matchScore: number;
  publicData: OptionPublicData;
  memberDetails: { userId: string; details: MemberDetails }[];
}

export interface BlockingCriterion {
  criterion: CriterionKey;
  label: string;
  /** Nombre de destinations qui redeviennent possibles si ce critère est assoupli. */
  unlocks: number;
  suggestion: string;
}

export interface Diagnostic {
  message: string;
  blocking: BlockingCriterion[];
}

export interface ResultSummary {
  /** Membres présents sur le week-end retenu. */
  present: number;
  /** Répondants indisponibles ce week-end-là. */
  absent: number;
  /** false = groupe trop petit, les décomptes « k/n » sont masqués. */
  aggregatesShown: boolean;
  feasibleCount: number;
  destinationCount: number;
  diagnostic?: Diagnostic;
  estimated: true;
}

export interface EngineResult {
  status: ResultStatus;
  engineVersion: string;
  respondents: number;
  weekendStart: string | null;
  summary: ResultSummary;
  options: EngineOption[];
}

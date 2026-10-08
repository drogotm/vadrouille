/**
 * MOTEUR DE DÉCISION COLLECTIVE — déterministe, explicable, équitable.
 *
 * 1. Week-end : on garde le(s) week-end(s) candidat(s) qui maximisent la présence
 *    (dispo = 1, peut-être = 0,5).
 * 2. Filtre dur : une option (destination × confort × week-end) est éliminée si elle viole un
 *    critère « indispensable » d'au moins un membre présent.
 * 3. Score individuel : satisfaction pondérée par critère, budget calculé depuis SA ville.
 * 4. Match Score = 100 × (0,7 × moyenne + 0,3 × satisfaction du membre le moins bien servi).
 * 5. Sélection : 🥇 Best Match, 💸 Budget Match, 🔥 Wild Card (3 destinations distinctes).
 * 6. Explications à partir d'agrégats filtrés (voir explain.ts).
 *
 * Aucun aléa, aucun LLM : mêmes entrées → mêmes sorties (ordre des membres indifférent).
 */
import { seedCatalog } from './catalog.ts';
import { type EngineConfig, resolveConfig } from './config.ts';
import { type EngineMember, type EvalContext, evaluateMember } from './evaluate.ts';
import {
  blockingCombination,
  blockingFor,
  blockingUnreachable,
  buildPublicData,
  type ExplainContext,
  presenceSentence,
  type ScoredCandidate,
} from './explain.ts';
import {
  type Availability,
  type BlockingCriterion,
  type Catalog,
  COMFORT_IDS,
  type ComfortId,
  type CriterionKey,
  type DecisionResult,
  type Destination,
  ENGINE_VERSION,
  type EngineOption,
  type OptionKind,
  type PublicSummary,
} from './types.ts';
import { CRITERIA } from './validate.ts';

export type { EngineMember } from './evaluate.ts';

export interface EngineInput {
  /** vendredis (ISO) des week-ends candidats */
  weekends: readonly string[];
  /** membres ayant répondu (réponses validées) */
  members: readonly EngineMember[];
  /** nombre total de membres de la Vadrouille (répondants ou non) */
  totalMembers?: number;
  nights?: number;
  catalog?: Catalog;
  config?: Partial<EngineConfig>;
}

const EPS = 1e-9;
const COMFORT_RANK: Record<ComfortId, number> = { roots: 0, confortable: 1, premium: 2 };

function availabilityOf(m: EngineMember, weekend: string): Availability {
  return m.answers.availability[weekend] ?? 'maybe';
}

/** Ordre total déterministe : meilleur score, puis moins cher, plus court, puis alphabétique. */
function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (Math.abs(a.rawScore - b.rawScore) > EPS) return b.rawScore - a.rawScore;
  if (Math.abs(a.avgCost - b.avgCost) > 0.5) return a.avgCost - b.avgCost;
  if (Math.abs(a.avgMinutes - b.avgMinutes) > 0.5) return a.avgMinutes - b.avgMinutes;
  return (
    a.destination.id.localeCompare(b.destination.id) ||
    a.weekend.localeCompare(b.weekend) ||
    COMFORT_RANK[a.comfort] - COMFORT_RANK[b.comfort]
  );
}

interface WeekendPresence {
  weekend: string;
  yes: number;
  maybe: number;
  score: number;
}

function weekendPresence(members: readonly EngineMember[], weekends: readonly string[], cfg: EngineConfig) {
  return weekends.map<WeekendPresence>((weekend) => {
    let yes = 0;
    let maybe = 0;
    for (const m of members) {
      const v = availabilityOf(m, weekend);
      if (v === 'yes') yes++;
      else if (v === 'maybe') maybe++;
    }
    return { weekend, yes, maybe, score: yes + cfg.maybeWeight * maybe };
  });
}

/** Évalue une option pour le groupe présent ; null si un membre présent l'exclut (critère indispensable). */
function scoreCandidate(
  present: readonly EngineMember[],
  dest: Destination,
  comfort: ComfortId,
  weekend: string,
  ctx: EvalContext,
): ScoredCandidate | null {
  const evals = new Map<string, ReturnType<typeof evaluateMember>>();
  for (const m of present) {
    const ev = evaluateMember(m, dest, comfort, availabilityOf(m, weekend), ctx);
    if (!ev.feasible) return null;
    evals.set(m.id, ev);
  }
  const cfg = ctx.config;
  let wSum = 0;
  let sSum = 0;
  let costSum = 0;
  let minutesSum = 0;
  const yesScores: number[] = [];
  const allScores: number[] = [];
  for (const m of present) {
    const ev = evals.get(m.id)!;
    const isYes = availabilityOf(m, weekend) === 'yes';
    const w = isYes ? 1 : cfg.maybeWeight;
    wSum += w;
    sSum += w * ev.score;
    costSum += ev.details.total;
    minutesSum += ev.minutes;
    allScores.push(ev.score);
    if (isYes) yesScores.push(ev.score);
  }
  const mean = sSum / wSum;
  // Équité : le membre le moins bien servi parmi les « dispo » (à défaut, parmi tous les présents)
  const min = Math.min(...(yesScores.length > 0 ? yesScores : allScores));
  const rawScore = cfg.meanWeight * mean + cfg.minWeight * min;
  return {
    weekend,
    destination: dest,
    comfort,
    rawScore,
    matchScore: Math.round(rawScore * 100),
    avgCost: costSum / present.length,
    avgMinutes: minutesSum / present.length,
    sunshine: ctx.catalog.sunshine(dest, Number(weekend.slice(5, 7))),
    present: [...present],
    evals,
  };
}

function presentOn(members: readonly EngineMember[], weekend: string) {
  return members.filter((m) => availabilityOf(m, weekend) !== 'no');
}

function allCandidates(
  members: readonly EngineMember[],
  weekends: readonly WeekendPresence[],
  base: Omit<EvalContext, 'month'>,
): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  for (const w of weekends) {
    const present = presentOn(members, w.weekend);
    if (present.length === 0) continue;
    const ctx: EvalContext = { ...base, month: Number(w.weekend.slice(5, 7)) };
    for (const dest of base.catalog.destinations) {
      // tout le monde habite déjà là : ce n'est pas un week-end ailleurs
      if (present.every((m) => dest.homeCity === m.answers.departureCity)) continue;
      for (const comfort of COMFORT_IDS) {
        const c = scoreCandidate(present, dest, comfort, w.weekend, ctx);
        if (c) out.push(c);
      }
    }
  }
  return out;
}

function countFeasibleDestinations(
  members: readonly EngineMember[],
  weekends: readonly WeekendPresence[],
  base: Omit<EvalContext, 'month'>,
): number {
  return new Set(allCandidates(members, weekends, base).map((c) => c.destination.id)).size;
}

function diagnose(
  members: readonly EngineMember[],
  weekends: readonly WeekendPresence[],
  base: Omit<EvalContext, 'month'>,
): BlockingCriterion[] {
  const hardKeys = CRITERIA.filter((k) =>
    members.some((m) => m.answers.importance[k] === 'indispensable'),
  );
  const found: BlockingCriterion[] = [];
  for (const k of hardKeys) {
    const unlocks = countFeasibleDestinations(members, weekends, { ...base, relax: new Set([k]) });
    if (unlocks > 0) found.push(blockingFor(k, unlocks));
  }
  found.sort(
    (a, b) =>
      b.unlocks - a.unlocks ||
      CRITERIA.indexOf(a.criterion as CriterionKey) - CRITERIA.indexOf(b.criterion as CriterionKey),
  );
  if (found.length > 0) return found.slice(0, 3);
  if (hardKeys.length > 0) {
    const unlocks = countFeasibleDestinations(members, weekends, { ...base, relax: new Set(hardKeys) });
    if (unlocks > 0) return [blockingCombination(unlocks)];
  }
  return [blockingUnreachable()];
}

/** Originalité d'une destination pour la Wild Card : peu populaire + cadre différent des autres options. */
function originality(dest: Destination, others: readonly Destination[]): number {
  const rarity = (5 - dest.popularity) / 4;
  const otherCadres = new Set(others.flatMap((d) => d.cadres));
  const shared = dest.cadres.filter((c) => otherCadres.has(c)).length;
  const novelty = dest.cadres.length === 0 ? 0 : 1 - shared / dest.cadres.length;
  return 0.65 * rarity + 0.35 * novelty;
}

export function decide(input: EngineInput): DecisionResult {
  const config = resolveConfig(input.config);
  const catalog = input.catalog ?? seedCatalog;
  const nights = input.nights ?? 2;
  // ordre canonique : le résultat ne dépend pas de l'ordre d'arrivée des réponses
  const members = [...input.members].sort((a, b) => a.id.localeCompare(b.id));
  const weekends = [...input.weekends].sort();
  const respondents = members.length;
  const totalMembers = Math.max(input.totalMembers ?? respondents, respondents);

  const summaryBase: PublicSummary = {
    respondents,
    totalMembers,
    weekend: null,
    aggregatesHidden: false,
    privacyThreshold: config.privacyThreshold,
    blocking: [],
  };
  const empty = (status: DecisionResult['status'], summary: PublicSummary): DecisionResult => ({
    status,
    engineVersion: ENGINE_VERSION,
    respondents,
    weekendStart: null,
    summary,
    options: [],
  });

  if (respondents === 0) {
    return empty('not_enough_answers', { ...summaryBase, message: 'Personne n’a encore répondu.' });
  }

  // 1. Week-end(s) qui maximisent la présence
  const presence = weekendPresence(members, weekends, config);
  const bestPresence = Math.max(0, ...presence.map((p) => p.score));
  if (bestPresence <= 0) {
    return empty('no_weekend', {
      ...summaryBase,
      message: 'Personne n’est dispo sur les week-ends proposés.',
      blocking: [
        {
          criterion: 'availability',
          unlocks: 0,
          message: 'Aucun des week-ends candidats ne réunit le groupe.',
          suggestion: 'Proposer d’autres dates (l’orga peut créer une nouvelle Vadrouille).',
        },
      ],
    });
  }
  const chosenWeekends = presence.filter((p) => p.score >= bestPresence - EPS);
  const base = { catalog, config, nights };

  // 2–4. Toutes les options faisables, scorées
  const candidates = allCandidates(members, chosenWeekends, base);

  if (candidates.length === 0) {
    return {
      ...empty('no_feasible', {
        ...summaryBase,
        message: 'Aucune destination ne respecte tous les critères indispensables.',
        blocking: diagnose(members, chosenWeekends, base),
      }),
      weekendStart: chosenWeekends[0].weekend,
    };
  }

  // 5. Sélection — meilleure variante (week-end × confort) par destination
  const bestByDest = new Map<string, ScoredCandidate>();
  for (const c of candidates) {
    const cur = bestByDest.get(c.destination.id);
    if (!cur || compareCandidates(c, cur) < 0) bestByDest.set(c.destination.id, c);
  }
  const ranked = [...bestByDest.values()].sort(compareCandidates);
  const best = ranked[0];

  // 💸 Budget Match : la moins chère pour le groupe au-dessus d'un plancher de Match Score
  const pickBudget = (floor: number) =>
    candidates
      .filter((c) => c.destination.id !== best.destination.id && c.matchScore >= floor)
      .sort(
        (a, b) =>
          a.avgCost - b.avgCost || compareCandidates(a, b),
      )[0];
  const budget =
    pickBudget(Math.max(config.budgetFloorAbs, best.matchScore - config.budgetFloorGap)) ??
    pickBudget(Math.max(config.wildFloorAbs, best.matchScore - config.wildFloorGap));

  // 🔥 Wild Card : plus originale, distincte des deux autres, au-dessus d'un plancher
  const taken = new Set([best.destination.id, budget?.destination.id]);
  const wildFloor = Math.max(config.wildFloorAbs, best.matchScore - config.wildFloorGap);
  const others = [best.destination, ...(budget ? [budget.destination] : [])];
  const wild = ranked
    .filter((c) => !taken.has(c.destination.id) && c.matchScore >= wildFloor)
    .map((c) => ({ c, value: 0.5 * c.rawScore + 0.5 * originality(c.destination, others) }))
    .sort((a, b) => b.value - a.value || compareCandidates(a.c, b.c))[0]?.c;

  const picks: { kind: OptionKind; c: ScoredCandidate }[] = [{ kind: 'best', c: best }];
  if (budget) picks.push({ kind: 'budget', c: budget });
  if (wild) picks.push({ kind: 'wild', c: wild });

  // 6. Sorties : données publiques filtrées + détails privés par membre
  const explainCtx: ExplainContext = { config, nights, respondents, best };
  const options: EngineOption[] = picks.map(({ kind, c }, i) => {
    const ctx: EvalContext = { ...base, month: Number(c.weekend.slice(5, 7)) };
    const memberDetails = members.map((m) => {
      const ev =
        c.evals.get(m.id) ?? evaluateMember(m, c.destination, c.comfort, availabilityOf(m, c.weekend), ctx);
      return { memberId: m.id, details: ev.details };
    });
    return {
      kind,
      position: (i + 1) as 1 | 2 | 3,
      destinationId: c.destination.id,
      weekendStart: c.weekend,
      comfort: c.comfort,
      matchScore: c.matchScore,
      publicData: buildPublicData(c, kind, explainCtx),
      memberDetails,
    };
  });

  return {
    status: 'ok',
    engineVersion: ENGINE_VERSION,
    respondents,
    weekendStart: best.weekend,
    summary: {
      ...summaryBase,
      weekend: { start: best.weekend, presence: presenceSentence(best, explainCtx) },
      aggregatesHidden: best.present.length < config.privacyThreshold,
    },
    options,
  };
}

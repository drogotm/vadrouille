import { SEED_CATALOG } from '../data/index.ts';
import { COMFORT_LEVELS, type Catalog, type ComfortLevel, type Destination } from '../data/types.ts';
import { DEFAULT_CONFIG, ENGINE_VERSION, type EngineConfig } from './config.ts';
import {
  CADRE_WANT,
  CRITERION_LABEL,
  CRITERION_SUGGESTION,
  ENVIE_WANT,
  formatDuration,
} from './labels.ts';
import { evaluateMember, groupScore, type MemberEvaluation } from './scoring.ts';
import {
  CRITERIA,
  type BlockingCriterion,
  type CriterionKey,
  type Diagnostic,
  type EngineInput,
  type EngineMember,
  type EngineOption,
  type EngineResult,
  type MemberDetails,
  type OptionKind,
  type OptionPublicData,
  type PublicAggregate,
  type ResultStatus,
  type ResultSummary,
} from './types.ts';

// ---------------------------------------------------------------------------
// Étape 1 — choix du week-end
// ---------------------------------------------------------------------------

export interface WeekendChoice {
  weekend: string | null;
  present: EngineMember[];
  absent: number;
}

/**
 * Retient le week-end qui maximise la présence (oui = 1, peut-être = maybeWeight).
 * Égalité : le plus de « oui » fermes, puis le plus proche dans le temps.
 */
export function chooseWeekend(
  weekends: string[],
  members: EngineMember[],
  config: EngineConfig = DEFAULT_CONFIG,
): WeekendChoice {
  let best: { weekend: string; score: number; yes: number } | null = null;
  for (const weekend of [...weekends].sort()) {
    let yes = 0;
    let maybe = 0;
    for (const m of members) {
      const a = m.answers.availability[weekend];
      if (a === 'yes') yes++;
      else if (a === 'maybe') maybe++;
    }
    const score = yes + config.maybeWeight * maybe;
    if (!best || score > best.score || (score === best.score && yes > best.yes)) {
      best = { weekend, score, yes };
    }
  }
  if (!best || best.score === 0) return { weekend: null, present: [], absent: members.length };
  const chosen = best.weekend;
  const present = members.filter((m) => {
    const a = m.answers.availability[chosen];
    return a === 'yes' || a === 'maybe';
  });
  return { weekend: chosen, present, absent: members.length - present.length };
}

// ---------------------------------------------------------------------------
// Étapes 2 à 4 — filtre dur, scores individuels, score de groupe
// ---------------------------------------------------------------------------

interface Candidate {
  dest: Destination;
  comfort: ComfortLevel;
  evals: MemberEvaluation[];
  violations: Set<CriterionKey>;
  score: number;
  matchScore: number;
  avgCost: number;
  avgMinutes: number;
}

function buildCandidates(
  present: EngineMember[],
  weekend: string,
  nights: number,
  catalog: Catalog,
  config: EngineConfig,
): Candidate[] {
  const out: Candidate[] = [];
  for (const dest of catalog.destinations) {
    for (const comfort of COMFORT_LEVELS) {
      if (dest.lodging[comfort] === undefined) continue;
      const evals = present.map((m) =>
        evaluateMember(m.answers, dest, comfort, weekend, nights, catalog, config),
      );
      const violations = new Set<CriterionKey>();
      for (const e of evals) for (const v of e.violations) violations.add(v);
      const score = groupScore(
        evals.map((e) => e.score),
        config,
      );
      out.push({
        dest,
        comfort,
        evals,
        violations,
        score,
        matchScore: Math.round(score * 100),
        avgCost: evals.reduce((s, e) => s + e.totalCost, 0) / evals.length,
        avgMinutes: evals.reduce((s, e) => s + e.travelMinutes, 0) / evals.length,
      });
    }
  }
  return out;
}

const comfortIdx = (c: ComfortLevel) => COMFORT_LEVELS.indexOf(c);

/** Ordre total et déterministe : meilleur score, puis moins cher, puis identifiant. */
function byMatch(a: Candidate, b: Candidate): number {
  return (
    b.score - a.score ||
    a.avgCost - b.avgCost ||
    a.dest.id.localeCompare(b.dest.id) ||
    comfortIdx(a.comfort) - comfortIdx(b.comfort)
  );
}

function byCost(a: Candidate, b: Candidate): number {
  return a.avgCost - b.avgCost || byMatch(a, b);
}

// ---------------------------------------------------------------------------
// Étape 5 — sélection des 3 options
// ---------------------------------------------------------------------------

interface Selected {
  kind: OptionKind;
  candidate: Candidate;
  reason: string;
}

export function selectOptions(feasible: Candidate[], config: EngineConfig): Selected[] {
  if (feasible.length === 0) return [];
  const ranked = [...feasible].sort(byMatch);
  const best = ranked[0];
  const selected: Selected[] = [
    { kind: 'best', candidate: best, reason: 'Le meilleur compromis pour tout le groupe' },
  ];

  // 💸 Budget Match : la moins chère (autre destination) au-dessus du plancher.
  const budgetPool = ranked.filter((c) => c.dest.id !== best.dest.id);
  if (budgetPool.length > 0) {
    const floor = Math.max(config.budgetFloor.absolute, best.matchScore - config.budgetFloor.belowBest);
    const aboveFloor = budgetPool.filter((c) => c.matchScore >= floor);
    const budget = [...(aboveFloor.length > 0 ? aboveFloor : budgetPool)].sort(byCost)[0];
    selected.push({
      kind: 'budget',
      candidate: budget,
      reason:
        aboveFloor.length > 0
          ? `L’option la moins chère au-dessus de ${floor} % de match`
          : 'L’option la moins chère pour le groupe',
    });

    // 🔥 Wild Card : une destination moins évidente qui tient quand même la route.
    const taken = new Set([best.dest.id, budget.dest.id]);
    const perDest = new Map<string, Candidate>();
    for (const c of ranked) {
      if (!taken.has(c.dest.id) && !perDest.has(c.dest.id)) perDest.set(c.dest.id, c);
    }
    const wildPool = [...perDest.values()];
    if (wildPool.length > 0) {
      const wildFloor = Math.max(config.wildFloor.absolute, best.matchScore - config.wildFloor.belowBest);
      const eligible = wildPool.filter((c) => c.matchScore >= wildFloor);
      const w = config.wildOriginalityWeight;
      const wildScore = (c: Candidate) => (1 - w) * c.matchScore + w * (100 - c.dest.popularity);
      const wild = [...(eligible.length > 0 ? eligible : wildPool)].sort(
        (a, b) => wildScore(b) - wildScore(a) || byMatch(a, b),
      )[0];
      selected.push({
        kind: 'wild',
        candidate: wild,
        reason: 'La surprise : moins évidente, mais elle coche vos cases',
      });
    }
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Étape 6 — explication à partir d'agrégats (avec seuils de confidentialité)
// ---------------------------------------------------------------------------

function buildPublicData(
  sel: Selected,
  present: EngineMember[],
  nights: number,
  config: EngineConfig,
): OptionPublicData {
  const { candidate: c } = sel;
  const n = present.length;
  const showCounts = n >= config.minAggregateGroup;
  const aggregates: PublicAggregate[] = [];
  const lines: string[] = [];

  if (showCounts) {
    const inBudget = c.evals.filter((e) => e.withinBudget).length;
    aggregates.push({
      key: 'budget',
      count: inBudget,
      total: n,
      label: `${inBudget}/${n} respectent leur budget`,
    });

    const wants: PublicAggregate[] = [];
    for (const envie of c.dest.envies) {
      const k = present.filter((m) => m.answers.envies.includes(envie)).length;
      if (k >= config.minAggregateCount) {
        wants.push({ key: `envie:${envie}`, count: k, total: n, label: `${k}/${n} voulaient ${ENVIE_WANT[envie]}` });
      }
    }
    for (const cadre of c.dest.cadres) {
      const k = present.filter((m) => m.answers.cadres.includes(cadre)).length;
      if (k >= config.minAggregateCount) {
        wants.push({ key: `cadre:${cadre}`, count: k, total: n, label: `${k}/${n} voulaient ${CADRE_WANT[cadre]}` });
      }
    }
    wants.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    aggregates.push(...wants.slice(0, 2));

    if (aggregates.length < 3) {
      const inTime = c.evals.filter((e) => e.withinTravelTime).length;
      aggregates.push({
        key: 'travelTime',
        count: inTime,
        total: n,
        label: `${inTime}/${n} sous leur temps de trajet max`,
      });
    }
    lines.push(...aggregates.map((a) => a.label));
  }

  const step = config.smallGroupCostRounding;
  const avgCost = showCounts ? Math.round(c.avgCost) : Math.round(c.avgCost / step) * step;
  const avgTravelMinutes = showCounts ? Math.round(c.avgMinutes) : Math.round(c.avgMinutes / 15) * 15;
  const approx = showCounts ? '' : '≈ ';
  return {
    destinationName: c.dest.name,
    country: c.dest.country,
    emoji: c.dest.emoji,
    tagline: c.dest.tagline,
    cadres: c.dest.cadres,
    envies: c.dest.envies,
    nights,
    kindReason: sel.reason,
    headline: `${c.dest.name} — ${c.matchScore} % Match`,
    avgCost,
    avgTravelMinutes,
    statsLine: `${approx}${avgCost} €/personne en moyenne · ${approx}${formatDuration(avgTravelMinutes)} de trajet moyen`,
    lines,
    aggregates,
    activities: c.dest.activities,
    restos: c.dest.restos,
    pitch: null,
    estimated: true,
  };
}

function toMemberDetails(e: MemberEvaluation, comfort: ComfortLevel, nights: number, present: boolean, budgetMax: number): MemberDetails {
  return {
    present,
    transport: e.chosen
      ? {
          mode: e.chosen.route.mode,
          minutes: e.chosen.route.minutes,
          costRoundTrip: e.transportCost,
          accepted: e.chosen.accepted,
        }
      : null,
    lodging: { comfort, perNight: e.lodgingPerNight, nights, total: e.lodgingCost },
    food: e.foodCost,
    activities: e.activitiesCost,
    total: e.totalCost,
    budgetMax,
    withinBudget: e.withinBudget,
    score: Math.round(e.score * 100),
  };
}

// ---------------------------------------------------------------------------
// Diagnostic « aucune option faisable » : quel critère bloque (jamais QUI)
// ---------------------------------------------------------------------------

export function diagnose(candidates: Candidate[], presentCount: number, config: EngineConfig): Diagnostic {
  if (presentCount < config.diagnosticMinGroup) {
    return {
      message:
        'Vos critères « indispensables » ne sont pas compatibles entre eux. Chacun peut en repasser un ou deux en « souhaitable », puis relancer le calcul.',
      blocking: [],
    };
  }
  const byDest = new Map<string, Set<CriterionKey>[]>();
  for (const c of candidates) {
    const list = byDest.get(c.dest.id) ?? [];
    list.push(c.violations);
    byDest.set(c.dest.id, list);
  }
  // nombre de destinations débloquées si on assouplit l'ensemble de critères `relaxed`
  const unlocks = (relaxed: CriterionKey[]) => {
    let count = 0;
    for (const sets of byDest.values()) {
      if (sets.some((s) => [...s].every((v) => relaxed.includes(v)))) count++;
    }
    return count;
  };
  const entry = (criterion: CriterionKey, n: number): BlockingCriterion => ({
    criterion,
    label: CRITERION_LABEL[criterion],
    unlocks: n,
    suggestion: CRITERION_SUGGESTION[criterion],
  });

  const singles = CRITERIA.map((c) => entry(c, unlocks([c])))
    .filter((b) => b.unlocks > 0)
    .sort((a, b) => b.unlocks - a.unlocks || CRITERIA.indexOf(a.criterion) - CRITERIA.indexOf(b.criterion));
  if (singles.length > 0) {
    const top = singles[0];
    return {
      message: `Ce qui bloque : ${top.label}. En l’assouplissant, ${top.unlocks} destination${top.unlocks > 1 ? 's deviennent possibles' : ' devient possible'}.`,
      blocking: singles.slice(0, 2),
    };
  }

  let bestPair: { pair: [CriterionKey, CriterionKey]; n: number } | null = null;
  for (let i = 0; i < CRITERIA.length; i++) {
    for (let j = i + 1; j < CRITERIA.length; j++) {
      const n = unlocks([CRITERIA[i], CRITERIA[j]]);
      if (n > 0 && (!bestPair || n > bestPair.n)) bestPair = { pair: [CRITERIA[i], CRITERIA[j]], n };
    }
  }
  if (bestPair) {
    const [a, b] = bestPair.pair;
    return {
      message: `Ce qui bloque : la combinaison ${CRITERION_LABEL[a]} + ${CRITERION_LABEL[b]}. En assouplissant les deux, ${bestPair.n} destination${bestPair.n > 1 ? 's deviennent possibles' : ' devient possible'}.`,
      blocking: [entry(a, bestPair.n), entry(b, bestPair.n)],
    };
  }

  // Trop de contraintes cumulées : on cite les critères les plus souvent en cause.
  const freq = new Map<CriterionKey, number>();
  for (const c of candidates) for (const v of c.violations) freq.set(v, (freq.get(v) ?? 0) + 1);
  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || CRITERIA.indexOf(a[0]) - CRITERIA.indexOf(b[0]))
    .slice(0, 3)
    .map(([c]) => entry(c, 0));
  return {
    message: `Trop de critères « indispensables » se cumulent, surtout : ${top.map((t) => t.label).join(', ')}. Il faut en assouplir plusieurs.`,
    blocking: top,
  };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * Moteur de décision Vadrouille. Fonction PURE et déterministe : aucune horloge, aucun
 * aléa, aucun appel réseau. L'ordre des membres en entrée n'influence pas le résultat.
 */
export function computeResults(
  input: EngineInput,
  catalog: Catalog = SEED_CATALOG,
  config: EngineConfig = DEFAULT_CONFIG,
): EngineResult {
  const members = [...input.members].sort((a, b) => a.userId.localeCompare(b.userId));
  const nights = Math.min(3, Math.max(1, Math.round(input.nights || 2)));
  const base = (status: ResultStatus, weekendStart: string | null, summary: Partial<ResultSummary>): EngineResult => ({
    status,
    engineVersion: ENGINE_VERSION,
    respondents: members.length,
    weekendStart,
    summary: {
      present: 0,
      absent: 0,
      aggregatesShown: false,
      feasibleCount: 0,
      destinationCount: catalog.destinations.length,
      estimated: true,
      ...summary,
    },
    options: [],
  });

  if (members.length === 0) return base('not_enough_answers', null, {});

  const { weekend, present, absent } = chooseWeekend(input.weekends, members, config);
  if (!weekend || present.length < Math.min(2, members.length)) {
    return base('no_weekend', null, { absent: members.length });
  }

  const candidates = buildCandidates(present, weekend, nights, catalog, config);
  const feasible = candidates.filter((c) => c.violations.size === 0);
  const summary: Partial<ResultSummary> = {
    present: present.length,
    absent,
    aggregatesShown: present.length >= config.minAggregateGroup,
    feasibleCount: new Set(feasible.map((c) => c.dest.id)).size,
  };

  if (feasible.length === 0) {
    return base('no_feasible', weekend, {
      ...summary,
      diagnostic: diagnose(candidates, present.length, config),
    });
  }

  const presentIds = new Set(present.map((m) => m.userId));
  const options: EngineOption[] = selectOptions(feasible, config).map((sel, i) => {
    const c = sel.candidate;
    return {
      kind: sel.kind,
      position: i + 1,
      destinationId: c.dest.id,
      weekendStart: weekend,
      comfort: c.comfort,
      matchScore: c.matchScore,
      publicData: buildPublicData(sel, present, nights, config),
      // budget individuel pour TOUS les répondants (les absents voient ce que ça leur coûterait)
      memberDetails: members.map((m) => ({
        userId: m.userId,
        details: toMemberDetails(
          evaluateMember(m.answers, c.dest, c.comfort, weekend, nights, catalog, config),
          c.comfort,
          nights,
          presentIds.has(m.userId),
          m.answers.budgetMax,
        ),
      })),
    };
  });

  return { ...base('ok', weekend, summary), options };
}

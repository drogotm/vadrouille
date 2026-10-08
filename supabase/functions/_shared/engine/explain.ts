/**
 * Explications publiques et règles de confidentialité des agrégats.
 *
 * Règle K (anti-réidentification) : les agrégats calculés à partir des réponses
 * (« 6/7 voulaient gastronomie », moyennes de coût / trajet, décompte des dispos) ne sont
 * affichés que si au moins `privacyThreshold` (4) membres sont présents sur l'option.
 * En dessous, chacun ne voit que SES propres chiffres + des infos issues des données
 * destinations (popularité, météo estimée…), qui ne disent rien des autres.
 * Une ligne d'envie/cadre n'est affichée que si au moins 2 membres la partagent.
 */
import type { EngineConfig } from './config.ts';
import type { EngineMember, MemberEvaluation } from './evaluate.ts';
import { CADRE_LABELS, CRITERION_LABELS, ENVIE_LABELS, formatDuration, formatEuros } from './labels.ts';
import type {
  BlockingCriterion,
  CriterionKey,
  Destination,
  OptionKind,
  OptionPublicData,
  Suggestion,
} from './types.ts';
import { ENVIES } from './validate.ts';

export interface ScoredCandidate {
  weekend: string;
  destination: Destination;
  comfort: 'roots' | 'confortable' | 'premium';
  rawScore: number;
  matchScore: number;
  avgCost: number;
  avgMinutes: number;
  sunshine: number;
  present: EngineMember[];
  evals: Map<string, MemberEvaluation>;
}

export interface ExplainContext {
  config: EngineConfig;
  nights: number;
  respondents: number;
  best?: ScoredCandidate;
}

export function aggregatesVisible(presentCount: number, config: EngineConfig): boolean {
  return presentCount >= config.privacyThreshold;
}

export function presenceSentence(c: ScoredCandidate, ctx: ExplainContext): string {
  const yes = c.present.filter((m) => m.answers.availability[c.weekend] === 'yes').length;
  const maybe = c.present.length - yes;
  const absent = ctx.respondents - c.present.length;
  if (absent === 0 && maybe === 0) return 'Tout le monde est dispo 🎉';
  if (aggregatesVisible(c.present.length, ctx.config)) {
    return `${yes}/${ctx.respondents} dispos${maybe > 0 ? ` · ${maybe} peut-être` : ''}`;
  }
  return 'Le week-end où vous êtes le plus nombreux';
}

function sortedSuggestions(list: readonly Suggestion[], present: EngineMember[]): Suggestion[] {
  const demand = (s: Suggestion) =>
    s.envie ? present.filter((m) => m.answers.envies.includes(s.envie!)).length : 0;
  return [...list]
    .map((s, i) => ({ s, i, d: demand(s) }))
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .map(({ s }) => s);
}

export function buildPublicData(c: ScoredCandidate, kind: OptionKind, ctx: ExplainContext): OptionPublicData {
  const n = c.present.length;
  const visible = aggregatesVisible(n, ctx.config);
  const evals = c.present.map((m) => c.evals.get(m.id)!);

  const highlights: string[] = [];
  if (visible) {
    const withinBudget = evals.filter((e) => e.details.withinBudget).length;
    highlights.push(`${withinBudget}/${n} respectent leur budget`);

    const demand: { label: string; count: number }[] = [];
    for (const e of ENVIES) {
      if ((c.destination.envies[e] ?? 0) < 2) continue;
      const count = c.present.filter((m) => m.answers.envies.includes(e)).length;
      if (count >= 2) demand.push({ label: ENVIE_LABELS[e].wanted, count });
    }
    for (const cadre of c.destination.cadres) {
      const count = c.present.filter((m) => m.answers.cadres.includes(cadre)).length;
      if (count >= 2) demand.push({ label: CADRE_LABELS[cadre].wanted, count });
    }
    demand.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    for (const d of demand.slice(0, 2)) highlights.push(`${d.count}/${n} ${d.label}`);

    if (highlights.length < 3) {
      const inTime = evals.filter((e) => e.withinTravelTime).length;
      highlights.push(`${inTime}/${n} sous leur temps de trajet max`);
    }
  }

  let reason: string;
  if (kind === 'best') {
    reason = 'Le meilleur compromis pour tout le groupe, sans sacrifier personne.';
  } else if (kind === 'budget') {
    const saving = ctx.best ? ctx.best.avgCost - c.avgCost : 0;
    reason =
      visible && saving >= 5
        ? `Environ ${formatEuros(saving)} de moins par personne que le Best Match.`
        : 'L’option la plus douce pour le porte-monnaie, qui plaît quand même au groupe.';
  } else {
    reason =
      c.destination.popularity <= 2
        ? 'Une pépite moins connue qui coche vos envies.'
        : 'Le pari dépaysant : moins évident, mais il colle à vos envies.';
  }

  return {
    headline: `${c.destination.name} — ${c.matchScore} % Match`,
    statsLine: visible
      ? `${formatEuros(c.avgCost)}/personne en moyenne · ${formatDuration(c.avgMinutes)} de trajet moyen`
      : null,
    highlights,
    pitch: c.destination.pitch,
    avgCost: visible ? Math.round(c.avgCost) : null,
    avgTravelMinutes: visible ? Math.round(c.avgMinutes) : null,
    sunshine: Math.round(c.sunshine * 100) / 100,
    presence: presenceSentence(c, ctx),
    nights: ctx.nights,
    reason,
    suggestions: {
      activities: sortedSuggestions(c.destination.activities, c.present),
      restaurants: [...c.destination.restaurants],
    },
  };
}

// ---------------------------------------------------------------------------
// Diagnostic « aucune option faisable » : quel critère bloque (sans dire qui)
// ---------------------------------------------------------------------------

const BLOCKING_COPY: Record<CriterionKey, { message: string; suggestion: string }> = {
  budget: {
    message: 'Le budget bloque : pour au moins une personne, aucune destination ne rentre dans son budget « indispensable ».',
    suggestion: 'passer le budget en « souhaitable » (ou l’augmenter un peu)',
  },
  travelTime: {
    message: 'Le temps de trajet bloque : au moins une personne a fixé un trajet maximum « indispensable » trop court.',
    suggestion: 'accepter un trajet un peu plus long',
  },
  transports: {
    message: 'Les transports bloquent : au moins une personne n’accepte que des modes qui ne mènent à aucune destination compatible.',
    suggestion: 'accepter un mode de transport de plus (bus, voiture…)',
  },
  cadres: {
    message: 'Le cadre bloque : les cadres « indispensables » du groupe ne se recoupent pas.',
    suggestion: 'passer le cadre en « souhaitable »',
  },
  envies: {
    message: 'Les envies bloquent : aucune destination ne couvre toutes les envies « indispensables ».',
    suggestion: 'passer les envies en « souhaitable »',
  },
  comfort: {
    message: 'Le confort bloque : le niveau de confort exigé ne rentre pas avec le reste des contraintes.',
    suggestion: 'accepter un niveau de confort plus simple',
  },
  weather: {
    message: 'La météo bloque : le grand soleil exigé est peu probable à ces dates.',
    suggestion: 'passer la météo en « souhaitable »',
  },
  ambiance: {
    message: 'L’ambiance bloque : les ambiances « indispensables » sont trop opposées.',
    suggestion: 'passer l’ambiance en « souhaitable »',
  },
};

function plural(n: number) {
  return n > 1
    ? `${n} destinations redeviennent possibles`
    : '1 destination redevient possible';
}

export function blockingFor(criterion: CriterionKey, unlocks: number): BlockingCriterion {
  const copy = BLOCKING_COPY[criterion];
  const label = CRITERION_LABELS[criterion];
  return {
    criterion,
    unlocks,
    message: copy.message,
    suggestion: `${label} : ${copy.suggestion} → ${plural(unlocks)}.`,
  };
}

export function blockingCombination(unlocks: number): BlockingCriterion {
  return {
    criterion: 'combination',
    unlocks,
    message: 'Plusieurs critères « indispensables » se contredisent : aucun ne bloque seul.',
    suggestion: `Passer un ou deux critères d’« indispensable » à « souhaitable » → ${plural(unlocks)}.`,
  };
}

export function blockingUnreachable(): BlockingCriterion {
  return {
    criterion: 'unreachable',
    unlocks: 0,
    message: 'Aucune destination du catalogue ne correspond, même en assouplissant les critères.',
    suggestion: 'Élargir les transports acceptés ou le temps de trajet, puis relancer le calcul.',
  };
}

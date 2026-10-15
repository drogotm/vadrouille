/**
 * Moteur de décision : groupes fictifs et cas limites.
 */
import { describe, expect, it } from 'vitest';

import {
  type Answers,
  type Catalog,
  decide,
  type Destination,
  type EngineMember,
} from '../../supabase/functions/_shared/engine/index.ts';
import { PERSONAS } from '../../src/lib/demo/personas.ts';

const W = ['2027-05-14', '2027-05-21', '2027-05-28'];

function answers(overrides: Partial<Answers> = {}): Answers {
  return {
    version: 1,
    availability: Object.fromEntries(W.map((w) => [w, 'yes'])),
    departureCity: 'paris',
    budgetMax: 350,
    maxTravelHours: 4,
    transports: ['train', 'car'],
    cadres: ['mer'],
    envies: ['gastronomie', 'fete'],
    comfort: 1,
    weather: 1,
    ambiance: 0.5,
    importance: {},
    ...overrides,
  };
}

const personas = (): EngineMember[] =>
  PERSONAS.slice(0, 5).map((p, i) => ({ id: `m${i}-${p.firstName}`, answers: p.answers(W) }));

describe('decide — groupe de 15 (taille maximale)', () => {
  it('trouve encore 3 options avec l’organisateur et les 14 potes de la démo', () => {
    const members: EngineMember[] = [
      { id: 'orga', answers: answers() },
      ...PERSONAS.map((p, i) => ({ id: `m${i}-${p.firstName}`, answers: p.answers(W) })),
    ];
    expect(members).toHaveLength(15);
    const result = decide({ weekends: W, members, totalMembers: 15 });
    expect(result.status).toBe('ok');
    expect(result.options).toHaveLength(3);
  });
});

describe('decide — villes de départ ajoutées le 15 oct. 2026', () => {
  it('un groupe venu de Montpellier, Nice, Rennes et Grenoble obtient 3 options', () => {
    const cities = ['montpellier', 'nice', 'rennes', 'grenoble'] as const;
    const members: EngineMember[] = cities.map((c) => ({
      id: c,
      answers: answers({ departureCity: c, maxTravelHours: 6, budgetMax: 450 }),
    }));
    const result = decide({ weekends: W, members, totalMembers: members.length });
    expect(result.status).toBe('ok');
    expect(result.options).toHaveLength(3);
  });
});

describe('decide — cas nominal', () => {
  const result = decide({ weekends: W, members: personas(), totalMembers: 5 });

  it('propose Best Match, Budget Match et Wild Card sur 3 destinations distinctes', () => {
    expect(result.status).toBe('ok');
    expect(result.options.map((o) => o.kind)).toEqual(['best', 'budget', 'wild']);
    expect(result.options.map((o) => o.position)).toEqual([1, 2, 3]);
    expect(new Set(result.options.map((o) => o.destinationId)).size).toBe(3);
  });

  it('le Best Match a le meilleur Match Score, tous entre 0 et 100', () => {
    const [best, ...others] = result.options;
    for (const o of result.options) {
      expect(o.matchScore).toBeGreaterThanOrEqual(0);
      expect(o.matchScore).toBeLessThanOrEqual(100);
    }
    for (const o of others) expect(o.matchScore).toBeLessThanOrEqual(best.matchScore);
  });

  it('le Budget Match respecte le plancher de Match Score', () => {
    const [best, budget] = result.options;
    expect(budget.matchScore).toBeGreaterThanOrEqual(Math.max(40, best.matchScore - 30));
  });

  it('respecte les critères indispensables de chacun (Max : budget indispensable)', () => {
    const max = result.options.flatMap((o) => o.memberDetails.filter((d) => d.memberId.includes('Max')));
    for (const d of max) {
      if (d.details.availability !== 'no') expect(d.details.total).toBeLessThanOrEqual(230);
    }
  });

  it('calcule le budget individuel depuis la ville de chacun, détail cohérent', () => {
    for (const o of result.options) {
      expect(o.memberDetails).toHaveLength(5);
      for (const { details } of o.memberDetails) {
        const transport = details.transport?.cost ?? 0;
        expect(transport + details.lodging + details.food + details.activities).toBe(details.total);
        expect(details.withinBudget).toBe(details.total <= details.budgetMax);
      }
    }
    // des villes de départ différentes → des coûts de transport différents
    const costs = new Set(result.options[0].memberDetails.map((d) => d.details.transport?.cost));
    expect(costs.size).toBeGreaterThan(1);
  });

  it('produit une explication au format attendu', () => {
    const best = result.options[0].publicData;
    expect(best.headline).toMatch(/^.+ — \d{1,3} % Match$/);
    expect(best.statsLine).toMatch(/€\/personne en moyenne · (\d+h\d{2}|\d+ min) de trajet moyen$/);
    expect(best.highlights[0]).toMatch(/^\d\/\d respectent leur budget$/);
    expect(best.highlights.length).toBeGreaterThanOrEqual(2);
  });

  it('choisit le week-end qui maximise la présence', () => {
    // présences : W0 = 4 dispo + 1 peut-être ; W1 = 4 dispo ; W2 = 3 dispo + 1 peut-être
    expect(result.weekendStart).toBe(W[0]);
  });
});

describe('decide — déterminisme', () => {
  it('mêmes entrées → mêmes sorties, quel que soit l’ordre des membres', () => {
    const members = personas();
    const a = decide({ weekends: W, members });
    const b = decide({ weekends: [...W].reverse(), members: [...members].reverse() });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe('decide — équité', () => {
  // Catalogue minimal : deux destinations identiques en coût et trajet, différentes en style.
  const dest = (id: string, extra: Partial<Destination>): Destination => ({
    id,
    name: id,
    region: '',
    country: '',
    emoji: '',
    colors: ['#000', '#fff'],
    lat: 0,
    lng: 0,
    cadres: [],
    envies: {},
    ambiance: 0.5,
    popularity: 3,
    climate: 'nord',
    costIndex: 1,
    activityCost: 20,
    pitch: '',
    activities: [],
    restaurants: [],
    ...extra,
  });
  const catalog: Catalog = {
    destinations: [
      dest('clivant', { cadres: ['mer'], envies: { fete: 3 }, ambiance: 0.8 }),
      dest('equilibre', { cadres: ['mer', 'montagne'], envies: { fete: 2, nature: 2 }, ambiance: 0.6 }),
    ],
    cities: [{ id: 'paris', name: 'Paris', lat: 0, lng: 0 }],
    route: () => ({ minutes: 120, cost: 60 }),
    lodgingPerNight: () => 40,
    foodPerDay: () => 30,
    activities: () => 20,
    sunshine: () => 0.6,
  };
  const fans = [0, 1, 2, 3].map((i) => ({
    id: `fan${i}`,
    answers: answers({ cadres: ['mer'], envies: ['fete'], ambiance: 0.8, budgetMax: 400 }),
  }));
  const solo = { id: 'solo', answers: answers({ cadres: ['montagne'], envies: ['nature'], ambiance: 0.2, budgetMax: 400 }) };

  it('ne sacrifie pas un membre pour maximiser la moyenne', () => {
    const r = decide({ weekends: W, members: [...fans, solo], catalog });
    expect(r.options[0].destinationId).toBe('equilibre');
  });

  it('sans la composante « minimum », la moyenne seule aurait sacrifié ce membre', () => {
    const r = decide({
      weekends: W,
      members: [...fans, solo],
      catalog,
      config: { meanWeight: 1, minWeight: 0 },
    });
    expect(r.options[0].destinationId).toBe('clivant');
  });
});

describe('decide — cas limites', () => {
  it('aucune réponse → not_enough_answers', () => {
    expect(decide({ weekends: W, members: [] }).status).toBe('not_enough_answers');
  });

  it('un seul membre → des options, mais aucun agrégat affiché', () => {
    const r = decide({ weekends: W, members: [{ id: 'seul', answers: answers() }] });
    expect(r.status).toBe('ok');
    expect(r.options.length).toBeGreaterThan(0);
    for (const o of r.options) {
      expect(o.publicData.statsLine).toBeNull();
      expect(o.publicData.highlights).toEqual([]);
      expect(o.publicData.avgCost).toBeNull();
      expect(o.memberDetails).toHaveLength(1);
    }
    expect(r.summary.aggregatesHidden).toBe(true);
  });

  it('personne n’est dispo → no_weekend', () => {
    const none = Object.fromEntries(W.map((w) => [w, 'no' as const]));
    const r = decide({ weekends: W, members: [{ id: 'a', answers: answers({ availability: none }) }] });
    expect(r.status).toBe('no_weekend');
    expect(r.summary.blocking[0].criterion).toBe('availability');
  });

  it('budgets très hétérogènes : le petit budget indispensable est respecté partout', () => {
    const members = [
      { id: 'serre', answers: answers({ budgetMax: 230, importance: { budget: 'indispensable' } }) },
      { id: 'large1', answers: answers({ budgetMax: 900, comfort: 2 }) },
      { id: 'large2', answers: answers({ budgetMax: 900, comfort: 2 }) },
      { id: 'large3', answers: answers({ budgetMax: 800, comfort: 2 }) },
    ];
    const r = decide({ weekends: W, members });
    expect(r.status).toBe('ok');
    for (const o of r.options) {
      const d = o.memberDetails.find((x) => x.memberId === 'serre')!;
      expect(d.details.total).toBeLessThanOrEqual(230);
    }
    // le Budget Match coûte moins cher en moyenne que le Best Match (agrégats visibles à 4)
    const [best, budget] = r.options;
    expect(budget.publicData.avgCost!).toBeLessThanOrEqual(best.publicData.avgCost!);
  });

  it('tout le monde « indispensable » partout : contraintes respectées si c’est possible', () => {
    const strict = {
      budget: 'indispensable',
      travelTime: 'indispensable',
      transports: 'indispensable',
      cadres: 'indispensable',
      envies: 'indispensable',
      comfort: 'indispensable',
      ambiance: 'indispensable',
    } as const;
    const members = [0, 1, 2].map((i) => ({
      id: `strict${i}`,
      answers: answers({
        budgetMax: 600,
        maxTravelHours: 4,
        transports: ['train'],
        cadres: ['mer', 'ville'],
        envies: ['gastronomie'],
        comfort: 1,
        ambiance: 0.5,
        importance: strict,
      }),
    }));
    const r = decide({ weekends: W, members });
    expect(r.status).toBe('ok');
    for (const o of r.options) {
      for (const { details } of o.memberDetails) {
        expect(details.total).toBeLessThanOrEqual(600);
        expect(details.transport?.mode ?? 'train').toBe('train');
        expect(details.transport?.minutes ?? 0).toBeLessThanOrEqual(240);
      }
      expect(o.comfort).not.toBe('roots');
    }
  });

  it('aucune option faisable → dit quel critère bloque, sans nommer personne', () => {
    const members = [
      { id: 'secret-user-1', answers: answers({ budgetMax: 90, importance: { budget: 'indispensable' } }) },
      { id: 'secret-user-2', answers: answers() },
      { id: 'secret-user-3', answers: answers() },
    ];
    const r = decide({ weekends: W, members });
    expect(r.status).toBe('no_feasible');
    expect(r.options).toEqual([]);
    expect(r.summary.blocking[0].criterion).toBe('budget');
    expect(r.summary.blocking[0].unlocks).toBeGreaterThan(0);
    const text = JSON.stringify(r.summary);
    expect(text).not.toContain('secret-user');
    expect(text).not.toContain('90');
  });

  it('cadres indispensables incompatibles → classe les critères à assouplir', () => {
    // mer + montagne en même temps : seule Ajaccio, inaccessible en train
    const strictTrain = { cadres: 'indispensable', transports: 'indispensable' } as const;
    const members = [
      { id: 'a', answers: answers({ cadres: ['mer'], transports: ['train'], importance: strictTrain }) },
      { id: 'b', answers: answers({ cadres: ['montagne'], transports: ['train'], importance: strictTrain }) },
    ];
    const r = decide({ weekends: W, members });
    expect(r.status).toBe('no_feasible');
    const [first, second] = r.summary.blocking;
    expect(first.criterion).toBe('cadres');
    expect(first.unlocks).toBeGreaterThan(5);
    expect(second.criterion).toBe('transports');
    expect(second.unlocks).toBe(1);
    expect(first.suggestion).toMatch(/destinations redeviennent possibles/);
  });

  it('ne propose jamais de « partir » dans la ville où tout le monde habite déjà', () => {
    const members = [0, 1, 2, 3].map((i) => ({
      id: `p${i}`,
      answers: answers({ cadres: ['ville'], envies: ['culture', 'fete'] }),
    }));
    const r = decide({ weekends: W, members });
    expect(r.options.map((o) => o.destinationId)).not.toContain('paris');
  });
});

describe('decide — confidentialité des agrégats', () => {
  it('masque tous les agrégats sous 4 membres présents', () => {
    const members = personas().slice(0, 3);
    const r = decide({ weekends: W, members });
    for (const o of r.options) {
      expect(o.publicData.statsLine).toBeNull();
      expect(o.publicData.highlights).toEqual([]);
      expect(o.publicData.avgCost).toBeNull();
      expect(o.publicData.avgTravelMinutes).toBeNull();
    }
  });

  it('les données publiques ne contiennent ni identifiant, ni budget, ni ville de départ', () => {
    const members = personas().map((m, i) => ({
      ...m,
      answers: { ...m.answers, budgetMax: 437 + i },
    }));
    const r = decide({ weekends: W, members });
    const publicJson = JSON.stringify({ summary: r.summary, options: r.options.map((o) => o.publicData) });
    for (const m of members) {
      expect(publicJson).not.toContain(m.id);
      expect(publicJson).not.toContain(String(m.answers.budgetMax));
    }
    expect(publicJson).not.toMatch(/departureCity|budgetMax/);
  });
});

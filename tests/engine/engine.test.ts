/**
 * Tests unitaires du moteur de décision (TypeScript pur, aucune base ni réseau).
 */
import { describe, expect, it } from 'vitest';
import { CITIES, DESTINATIONS, SEED_CATALOG } from '../../supabase/functions/_shared/data/index.ts';
import {
  chooseRoute,
  chooseWeekend,
  computeResults,
  CRITERIA,
  DEFAULT_CONFIG,
  evaluateMember,
  groupScore,
  normalizeAnswers,
  type Importance,
} from '../../supabase/functions/_shared/engine/index.ts';
import { answers, BANDE_DE_7, dest, input, member, miniCatalog, WEEKENDS } from './fixtures';

const allMust = Object.fromEntries(CRITERIA.map((c) => [c, 'must' as Importance]));

describe('données seed', () => {
  it('contient ~40 destinations cohérentes', () => {
    expect(DESTINATIONS.length).toBeGreaterThanOrEqual(38);
    expect(new Set(DESTINATIONS.map((d) => d.id)).size).toBe(DESTINATIONS.length);
    for (const d of DESTINATIONS) {
      expect(Object.keys(d.lodging).length, d.id).toBeGreaterThan(0);
      expect(d.cadres.length, d.id).toBeGreaterThan(0);
      expect(d.envies.length, d.id).toBeGreaterThan(0);
      expect(d.popularity).toBeGreaterThanOrEqual(0);
      expect(d.popularity).toBeLessThanOrEqual(100);
      expect(d.ambiance).toBeGreaterThanOrEqual(0);
      expect(d.ambiance).toBeLessThanOrEqual(1);
      expect(d.activities.length, d.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('couvre les 8 villes de départ, chacune reliée à toutes les destinations', () => {
    expect(CITIES.map((c) => c.id).sort()).toEqual(
      ['bordeaux', 'lille', 'lyon', 'marseille', 'nantes', 'paris', 'strasbourg', 'toulouse'].sort(),
    );
    for (const c of CITIES) {
      for (const d of DESTINATIONS) {
        const routes = SEED_CATALOG.getRoutes(c.id, d.id);
        expect(routes.length, `${c.id}>${d.id}`).toBeGreaterThan(0);
        for (const r of routes) {
          expect(r.minutes).toBeGreaterThanOrEqual(0);
          expect(r.cost).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('utilise les valeurs saisies à la main quand elles existent, et un trajet nul sur place', () => {
    const train = SEED_CATALOG.getRoutes('paris', 'bordeaux').find((r) => r.mode === 'train')!;
    expect(train).toMatchObject({ minutes: 128, cost: 55, source: 'manual' });
    const local = SEED_CATALOG.getRoutes('bordeaux', 'bordeaux');
    expect(local.every((r) => r.minutes === 0 && r.cost === 0)).toBe(true);
  });
});

describe('déterminisme', () => {
  it('mêmes entrées → même résultat, quel que soit l’ordre des membres', () => {
    const a = computeResults(input(BANDE_DE_7));
    const b = computeResults(input(BANDE_DE_7));
    const shuffled = computeResults(input([...BANDE_DE_7].reverse()));
    expect(b).toEqual(a);
    expect(shuffled).toEqual(a);
  });
});

describe('groupe type de 7 personnes', () => {
  const result = computeResults(input(BANDE_DE_7));

  it('propose 3 options distinctes : Best, Budget, Wild', () => {
    expect(result.status).toBe('ok');
    expect(result.options.map((o) => o.kind)).toEqual(['best', 'budget', 'wild']);
    expect(result.options.map((o) => o.position)).toEqual([1, 2, 3]);
    expect(new Set(result.options.map((o) => o.destinationId)).size).toBe(3);
    for (const o of result.options) {
      expect(o.matchScore).toBeGreaterThanOrEqual(0);
      expect(o.matchScore).toBeLessThanOrEqual(100);
    }
  });

  it('le Best Match a le meilleur score, le Budget Match est moins cher que lui', () => {
    const [best, budget, wild] = result.options;
    expect(best.matchScore).toBeGreaterThanOrEqual(budget.matchScore);
    expect(best.matchScore).toBeGreaterThanOrEqual(wild.matchScore);
    expect(budget.publicData.avgCost).toBeLessThanOrEqual(best.publicData.avgCost);
  });

  it('la Wild Card est moins « évidente » que le Best Match', () => {
    const pop = (id: string) => DESTINATIONS.find((d) => d.id === id)!.popularity;
    expect(pop(result.options[2].destinationId)).toBeLessThan(pop(result.options[0].destinationId));
  });

  it('explique chaque option au format attendu', () => {
    for (const o of result.options) {
      expect(o.publicData.headline).toMatch(/^.+ — \d{1,3} % Match$/);
      expect(o.publicData.statsLine).toMatch(/^\d+ €\/personne en moyenne · (\d+h\d{2}|\d+ min) de trajet moyen$/);
      expect(o.publicData.lines.length).toBeGreaterThanOrEqual(2);
      expect(o.publicData.lines[0]).toMatch(/^\d\/7 respectent leur budget$/);
      expect(o.publicData.estimated).toBe(true);
    }
    expect(result.options[0].publicData.lines.join(' · ')).toMatch(/\d\/7 voulaient/);
  });

  it('calcule le budget de chacun depuis SA ville de départ', () => {
    const r = computeResults(input(BANDE_DE_7), miniCatalog([DESTINATIONS.find((d) => d.id === 'bordeaux')!]));
    const details = Object.fromEntries(r.options[0].memberDetails.map((m) => [m.userId, m.details]));
    expect(details['u-jade'].transport).toMatchObject({ minutes: 0, costRoundTrip: 0 }); // Bordelaise
    expect(details['u-lea'].transport).toMatchObject({ mode: 'train', minutes: 128, costRoundTrip: 110 });
    expect(details['u-lea'].total).toBe(
      110 + details['u-lea'].lodging.total + details['u-lea'].food + details['u-lea'].activities,
    );
    expect(details['u-jade'].total).toBeLessThan(details['u-lea'].total);
  });
});

describe('filtre dur (critères indispensables)', () => {
  it('budget indispensable : aucune option ne le dépasse pour ce membre', () => {
    const tight = member('u-serre', { budgetMax: 190, importance: { budget: 'must' }, comfort: 0 });
    const r = computeResults(input([...BANDE_DE_7, tight]));
    expect(r.status).toBe('ok');
    for (const o of r.options) {
      const mine = o.memberDetails.find((m) => m.userId === 'u-serre')!.details;
      expect(mine.total).toBeLessThanOrEqual(190);
      expect(mine.withinBudget).toBe(true);
    }
  });

  it('temps de trajet indispensable : respecté dans toutes les options', () => {
    const pressé = member('u-presse', { maxTravelHours: 2, importance: { travelTime: 'must' } });
    const r = computeResults(input([...BANDE_DE_7, pressé]));
    for (const o of r.options) {
      const mine = o.memberDetails.find((m) => m.userId === 'u-presse')!.details;
      expect(mine.transport!.minutes).toBeLessThanOrEqual(120);
    }
  });

  it('transport indispensable : élimine les destinations non desservies', () => {
    const sansGare = dest('sans-gare', { rail: null, bus: false, lat: 44, lon: 1 });
    const avecGare = dest('avec-gare', { lat: 44.2, lon: 1.2 });
    const trainOnly = { transports: ['train' as const], importance: { transports: 'must' as const } };
    const r = computeResults(
      input([member('a', trainOnly), member('b')]),
      miniCatalog([sansGare, avecGare]),
    );
    expect(r.options.map((o) => o.destinationId)).toEqual(['avec-gare']);
    // sans « indispensable », la destination reste possible mais le transport est signalé non accepté
    const soft = computeResults(
      input([member('a', { transports: ['train'] }), member('b')]),
      miniCatalog([sansGare]),
    );
    expect(soft.status).toBe('ok');
    expect(soft.options[0].memberDetails.find((m) => m.userId === 'a')!.details.transport!.accepted).toBe(false);
  });

  it('budgets très hétérogènes : le petit budget indispensable est protégé', () => {
    const r = computeResults(
      input([
        member('riche-1', { budgetMax: 1200, comfort: 2 }),
        member('riche-2', { budgetMax: 900, comfort: 2 }),
        member('riche-3', { budgetMax: 1500, comfort: 2 }),
        member('etudiant', { budgetMax: 220, comfort: 0, importance: { budget: 'must' } }),
      ]),
    );
    expect(r.status).toBe('ok');
    for (const o of r.options) {
      expect(o.memberDetails.find((m) => m.userId === 'etudiant')!.details.total).toBeLessThanOrEqual(220);
    }
  });
});

describe('équité', () => {
  it('pénalise une option qui sacrifie une personne', () => {
    const sacrifie = groupScore([1, 1, 0.4], DEFAULT_CONFIG); // moyenne 0,80
    const equilibre = groupScore([0.75, 0.75, 0.75], DEFAULT_CONFIG); // moyenne 0,75
    expect(equilibre).toBeGreaterThan(sacrifie);
    expect(groupScore([0.8], DEFAULT_CONFIG)).toBeCloseTo(0.8);
  });

  it('préfère la destination correcte pour tous à celle parfaite pour la majorité', () => {
    // « pour-tous » couvre la moitié des envies de chacun ; « majorité » comble 2 membres et ignore le 3ᵉ.
    const pourTous = dest('pour-tous', { envies: ['gastronomie', 'nature'], cadres: ['ville', 'mer'] });
    const majorite = dest('majorite', { envies: ['gastronomie', 'fete'], cadres: ['ville'] });
    const r = computeResults(
      input([
        member('a', { envies: ['gastronomie', 'fete'], cadres: ['ville'] }),
        member('b', { envies: ['gastronomie', 'fete'], cadres: ['ville'] }),
        member('c', { envies: ['nature'], cadres: ['mer'] }),
      ]),
      miniCatalog([pourTous, majorite]),
    );
    expect(r.options[0].destinationId).toBe('pour-tous');
  });

  it('« souhaitable » pèse plus que « négociable »', () => {
    const d = dest('d', { envies: ['sport'] }); // ne couvre pas l'envie « gastronomie »
    const args = [d, 'confortable', WEEKENDS[0], 2, miniCatalog([d]), DEFAULT_CONFIG] as const;
    const nice = evaluateMember(answers(), ...args).score;
    const flex = evaluateMember(answers({ importance: { envies: 'flex' } }), ...args).score;
    expect(flex).toBeGreaterThan(nice);
  });
});

describe('cas limites', () => {
  it('aucune option faisable : dit quel critère bloque, sans dire qui', () => {
    const fauches = ['a', 'b', 'c', 'd'].map((id) =>
      member(`user-${id}`, { budgetMax: 40, importance: { budget: 'must' }, departureCity: 'lille' }),
    );
    const r = computeResults(input(fauches));
    expect(r.status).toBe('no_feasible');
    expect(r.options).toEqual([]);
    const diag = r.summary.diagnostic!;
    expect(diag.blocking[0].criterion).toBe('budget');
    expect(diag.blocking[0].unlocks).toBe(DESTINATIONS.length);
    expect(diag.blocking[0].suggestion).toMatch(/budget/i);
    expect(diag.message).toMatch(/le budget/);
    expect(JSON.stringify(r)).not.toMatch(/user-[abcd]/);
  });

  it('aucune option faisable à cause de deux critères combinés', () => {
    const d = dest('loin-et-cher', { lat: 43.3, lon: 5.4, lodging: { confortable: 200 } });
    const r = computeResults(
      input([
        member('a', { budgetMax: 100, importance: { budget: 'must' } }),
        member('b', { maxTravelHours: 1, importance: { travelTime: 'must' } }),
        member('c'),
      ]),
      miniCatalog([d]),
    );
    expect(r.status).toBe('no_feasible');
    expect(r.summary.diagnostic!.blocking.map((b) => b.criterion).sort()).toEqual(['budget', 'travelTime']);
    expect(r.summary.diagnostic!.message).toMatch(/combinaison/);
  });

  it('un seul membre : résultat valide, sans aucun décompte', () => {
    const r = computeResults(input([member('solo')]));
    expect(r.status).toBe('ok');
    expect(r.options).toHaveLength(3);
    expect(r.summary.aggregatesShown).toBe(false);
    for (const o of r.options) expect(o.publicData.lines).toEqual([]);
  });

  it('tout le monde met tout en « indispensable » : pas de crash, résultat cohérent', () => {
    const group = BANDE_DE_7.map((m) => ({ ...m, answers: { ...m.answers, importance: allMust } }));
    const r = computeResults(input(group));
    expect(['ok', 'no_feasible']).toContain(r.status);
    if (r.status === 'no_feasible') {
      expect(r.summary.diagnostic!.message.length).toBeGreaterThan(10);
      expect(r.summary.diagnostic!.blocking.length).toBeGreaterThan(0);
    }
    // un groupe homogène tout en « indispensable » trouve quand même des options
    const ete = ['2027-07-09', '2027-07-16'];
    const homogene = ['a', 'b', 'c', 'd'].map((id) =>
      member(id, {
        importance: allMust,
        budgetMax: 450,
        envies: ['gastronomie'],
        cadres: ['ville'],
        weather: 1,
        availability: { [ete[0]]: 'yes', [ete[1]]: 'yes' },
      }),
    );
    const ok = computeResults(input(homogene, { weekends: ete }));
    expect(ok.status).toBe('ok');
    for (const o of ok.options) {
      for (const m of o.memberDetails) expect(m.details.withinBudget).toBe(true);
    }
  });

  it('aucun répondant, ou personne de disponible', () => {
    expect(computeResults(input([])).status).toBe('not_enough_answers');
    const no = Object.fromEntries(WEEKENDS.map((w) => [w, 'no' as const]));
    expect(computeResults(input([member('a', { availability: no }), member('b', { availability: no })])).status).toBe(
      'no_weekend',
    );
  });

  it('moins de 3 destinations faisables : renvoie ce qui existe', () => {
    const r = computeResults(input([member('a'), member('b')]), miniCatalog([dest('seule')]));
    expect(r.options.map((o) => o.kind)).toEqual(['best']);
    const two = computeResults(input([member('a'), member('b')]), miniCatalog([dest('x'), dest('y', { lat: 46 })]));
    expect(two.options.map((o) => o.kind)).toEqual(['best', 'budget']);
  });
});

describe('choix du week-end', () => {
  const avail = (...v: ('yes' | 'no' | 'maybe')[]) => Object.fromEntries(WEEKENDS.map((w, i) => [w, v[i]]));

  it('retient le week-end qui maximise la présence', () => {
    const members = [
      member('a', { availability: avail('no', 'yes', 'yes') }),
      member('b', { availability: avail('yes', 'yes', 'no') }),
      member('c', { availability: avail('no', 'yes', 'maybe') }),
    ];
    const choice = chooseWeekend(WEEKENDS, members);
    expect(choice.weekend).toBe(WEEKENDS[1]);
    expect(choice.present).toHaveLength(3);
    expect(choice.absent).toBe(0);
  });

  it('un « oui » pèse plus qu’un « peut-être » ; à égalité, le plus tôt', () => {
    const members = [
      member('a', { availability: avail('maybe', 'yes', 'yes') }),
      member('b', { availability: avail('maybe', 'no', 'no') }),
    ];
    // W1 : 2 peut-être = 1 ; W2 : 1 oui = 1 → égalité de score, W2 a plus de oui fermes
    expect(chooseWeekend(WEEKENDS, members).weekend).toBe(WEEKENDS[1]);
  });

  it('seuls les membres présents comptent dans le score et le filtre dur', () => {
    const absent = member('absent', {
      availability: avail('no', 'no', 'no'),
      budgetMax: 10,
      importance: { budget: 'must' },
    });
    const r = computeResults(input([...BANDE_DE_7, absent]));
    expect(r.status).toBe('ok');
    expect(r.summary).toMatchObject({ present: 7, absent: 1 });
    expect(r.options[0].memberDetails.find((m) => m.userId === 'absent')!.details.present).toBe(false);
  });
});

describe('confidentialité des agrégats', () => {
  it('sous 4 membres présents : aucun décompte « k/n », coûts arrondis', () => {
    const r = computeResults(input(BANDE_DE_7.slice(0, 3)));
    expect(r.summary.aggregatesShown).toBe(false);
    for (const o of r.options) {
      expect(o.publicData.lines).toEqual([]);
      expect(o.publicData.aggregates).toEqual([]);
      expect(o.publicData.avgCost % 10).toBe(0);
      expect(o.publicData.statsLine.startsWith('≈')).toBe(true);
    }
  });

  it('à partir de 4 membres : décomptes publiés, jamais pour une envie isolée', () => {
    const group = [
      ...BANDE_DE_7.slice(0, 3),
      member('u-seul', { envies: ['bienetre'], cadres: ['montagne'] }),
    ];
    const r = computeResults(input(group));
    expect(r.summary.aggregatesShown).toBe(true);
    for (const o of r.options) {
      for (const a of o.publicData.aggregates) {
        expect(a.total).toBe(4);
        if (a.key.startsWith('envie:') || a.key.startsWith('cadre:')) expect(a.count).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('les données publiques ne contiennent ni identifiant ni budget individuel', () => {
    const r = computeResults(input(BANDE_DE_7));
    const publicJson = JSON.stringify({ summary: r.summary, options: r.options.map((o) => o.publicData) });
    for (const m of BANDE_DE_7) expect(publicJson).not.toContain(m.userId);
    expect(publicJson).not.toContain('budgetMax');
    expect(publicJson).not.toContain('departureCity');
  });

  it('petit groupe bloqué : le diagnostic ne nomme pas le critère', () => {
    const r = computeResults(
      input([member('a', { budgetMax: 30, importance: { budget: 'must' } }), member('b')]),
    );
    expect(r.status).toBe('no_feasible');
    expect(r.summary.diagnostic!.blocking).toEqual([]);
    expect(r.summary.diagnostic!.message).not.toMatch(/budget/);
  });
});

describe('utilitaires', () => {
  it('choisit le trajet le moins cher qui tient dans le temps max', () => {
    const routes = [
      { mode: 'train' as const, minutes: 120, cost: 60, source: 'model' as const },
      { mode: 'bus' as const, minutes: 400, cost: 15, source: 'model' as const },
      { mode: 'car' as const, minutes: 200, cost: 30, source: 'model' as const },
    ];
    expect(chooseRoute(answers({ transports: ['train', 'car', 'bus'], maxTravelHours: 4 }), routes)!.route.mode).toBe('car');
    expect(chooseRoute(answers({ transports: ['bus'], maxTravelHours: 4 }), routes)).toMatchObject({
      accepted: true,
      route: { mode: 'bus' },
    });
    expect(chooseRoute(answers({ transports: ['plane'] }), routes)!.accepted).toBe(false);
    expect(chooseRoute(answers(), [])).toBeNull();
  });

  it('normalise des réponses abîmées sans planter', () => {
    const a = normalizeAnswers(
      { budgetMax: 'beaucoup', transports: ['fusée', 'train'], comfort: 9, importance: { budget: 'must', x: 'must' } },
      WEEKENDS,
    );
    expect(a.budgetMax).toBe(300);
    expect(a.transports).toEqual(['train']);
    expect(a.comfort).toBe(2);
    expect(a.importance).toEqual({ budget: 'must' });
    expect(Object.values(a.availability)).toEqual(['no', 'no', 'no']);
    expect(() => computeResults(input([{ userId: 'x', answers: normalizeAnswers(null, WEEKENDS) }]))).not.toThrow();
  });
});

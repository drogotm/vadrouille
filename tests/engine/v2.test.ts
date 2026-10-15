/**
 * Retours V2 (15 oct. 2026) : vélo et nouvelles envies.
 */
import { describe, expect, it } from 'vitest';

import {
  type Answers,
  decide,
  DESTINATIONS,
  ENVIES,
  type EngineMember,
  getDestination,
  parseAnswers,
  seedCatalog,
} from '../../supabase/functions/_shared/engine/index.ts';

const W = ['2027-05-14', '2027-05-21'];

function answers(overrides: Partial<Answers> = {}): Answers {
  return {
    version: 1,
    availability: Object.fromEntries(W.map((w) => [w, 'yes'])),
    departureCity: 'marseille',
    budgetMax: 400,
    maxTravelHours: 5,
    transports: ['train', 'car'],
    cadres: [],
    envies: [],
    comfort: 1,
    weather: 1,
    ambiance: 0.5,
    importance: {},
    ...overrides,
  };
}

describe('vélo', () => {
  it('trajet gratuit pour une destination proche, aucun au-delà de 100 km de route', () => {
    const cassis = seedCatalog.route('marseille', 'cassis', 'bike');
    expect(cassis).not.toBeNull();
    expect(cassis!.cost).toBe(0);
    expect(seedCatalog.route('paris', 'nice', 'bike')).toBeNull();
  });

  it('n’est jamais retenu pour qui ne l’a pas coché', () => {
    const members: EngineMember[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, answers: answers() }));
    const result = decide({ weekends: W, members, totalMembers: 4 });
    for (const o of result.options) {
      for (const m of o.memberDetails) expect(m.details.transport?.mode).not.toBe('bike');
    }
  });

  it('peut être retenu pour qui l’a coché, si la destination est proche', () => {
    const cyclist = answers({
      transports: ['bike'],
      envies: ['sport'],
      maxTravelHours: 3,
      importance: { transports: 'indispensable', travelTime: 'indispensable' },
    });
    const members: EngineMember[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, answers: cyclist }));
    const result = decide({ weekends: W, members, totalMembers: 4 });
    expect(result.options.length).toBeGreaterThan(0);
    for (const o of result.options) {
      for (const m of o.memberDetails) expect(m.details.transport?.mode).toBe('bike');
    }
  });

  it('est accepté par la validation des réponses', () => {
    expect(parseAnswers({ ...answers(), transports: ['bike'] }, W)?.transports).toEqual(['bike']);
  });
});

describe('nouvelles envies', () => {
  it('chaque envie est vraiment proposée par plusieurs destinations (intensité ≥ 2)', () => {
    for (const e of ENVIES) {
      expect(DESTINATIONS.filter((d) => (d.envies[e] ?? 0) >= 2).length, e).toBeGreaterThanOrEqual(5);
    }
  });

  it('un groupe « sensations fortes » part vers un spot qui en propose', () => {
    const fans = answers({ departureCity: 'lyon', envies: ['sensations'], importance: { envies: 'indispensable' } });
    const members: EngineMember[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, answers: fans }));
    const result = decide({ weekends: W, members, totalMembers: 4 });
    expect(result.status).toBe('ok');
    for (const o of result.options) {
      expect(getDestination(o.destinationId)?.envies.sensations ?? 0).toBeGreaterThanOrEqual(2);
    }
  });
});

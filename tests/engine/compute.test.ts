/** Validation des réponses et orchestration serveur (permissions, sérialisation). */
import { describe, expect, it } from 'vitest';

import {
  computePermission,
  type ComputeInput,
  runCompute,
  toSavePayload,
} from '../../supabase/functions/_shared/compute.ts';
import { parseAnswers } from '../../supabase/functions/_shared/engine/index.ts';
import { PERSONAS } from '../../src/lib/demo/personas.ts';

const W = ['2027-05-14', '2027-05-21'];

describe('parseAnswers', () => {
  const valid = PERSONAS[0].answers(W);

  it('accepte une réponse valide', () => {
    expect(parseAnswers(valid, W)).toEqual(valid);
  });

  it('rejette une ville inconnue ou des nombres invalides', () => {
    expect(parseAnswers({ ...valid, departureCity: 'atlantis' }, W)).toBeNull();
    expect(parseAnswers({ ...valid, budgetMax: '300' }, W)).toBeNull();
    expect(parseAnswers(null, W)).toBeNull();
    expect(parseAnswers([], W)).toBeNull();
  });

  it('normalise : bornes, valeurs inconnues filtrées, dispo manquante = peut-être', () => {
    const parsed = parseAnswers(
      {
        ...valid,
        budgetMax: 99999,
        ambiance: 4,
        transports: ['train', 'teleportation', 'train'],
        envies: ['fete', 'sieste'],
        availability: { [W[0]]: 'yes', [W[1]]: 'bof' },
        importance: { budget: 'indispensable', envies: 'vital', inconnu: 'negociable' },
      },
      W,
    )!;
    expect(parsed.budgetMax).toBe(10000);
    expect(parsed.ambiance).toBe(1);
    expect(parsed.transports).toEqual(['train']);
    expect(parsed.envies).toEqual(['fete']);
    expect(parsed.availability).toEqual({ [W[0]]: 'yes', [W[1]]: 'maybe' });
    expect(parsed.importance).toEqual({ budget: 'indispensable' });
  });
});

function input(overrides: Partial<ComputeInput['vadrouille']> = {}, responded = [true, true, false]): ComputeInput {
  const members = ['org', 'm1', 'm2'].map((userId, i) => ({
    userId,
    firstName: userId,
    role: (i === 0 ? 'organizer' : 'member') as 'organizer' | 'member',
    respondedAt: responded[i] ? '2026-10-08T10:00:00Z' : null,
  }));
  return {
    vadrouille: {
      id: 'v1',
      name: 'Test',
      organizerId: 'org',
      weekends: W,
      nights: 2,
      expectedSize: 3,
      status: 'collecting',
      ...overrides,
    },
    members,
    responses: members
      .filter((m) => m.respondedAt)
      .map((m, i) => ({ userId: m.userId, answers: PERSONAS[i].answers(W) })),
  };
}

describe('computePermission', () => {
  it("l'organisateur peut forcer le calcul dès qu'une réponse existe", () => {
    expect(computePermission(input(), 'org')).toEqual({ allowed: true });
  });

  it('un membre ne peut déclencher que quand tout le monde a répondu', () => {
    expect(computePermission(input(), 'm1')).toEqual({ allowed: false, reason: 'not_allowed' });
    expect(computePermission(input({}, [true, true, true]), 'm1')).toEqual({ allowed: true });
  });

  it('refuse les non-membres, les Vadrouilles décidées et l’absence de réponse', () => {
    expect(computePermission(input(), 'intrus')).toMatchObject({ allowed: false, reason: 'not_a_member' });
    expect(computePermission(input({ status: 'decided' }), 'org')).toMatchObject({ reason: 'already_decided' });
    expect(computePermission(input({}, [false, false, false]), 'org')).toMatchObject({ reason: 'no_answers' });
  });
});

describe('runCompute / toSavePayload', () => {
  it('ignore les réponses invalides et celles de non-membres', () => {
    const i = input({}, [true, true, true]);
    i.responses.push({ userId: 'fantome', answers: PERSONAS[3].answers(W) });
    i.responses[2] = { userId: 'm2', answers: { cassé: true } };
    const { result, invalidResponses } = runCompute(i);
    expect(invalidResponses).toEqual(['m2']);
    expect(result.respondents).toBe(2);
  });

  it('associe chaque détail individuel à son userId', () => {
    const { result } = runCompute(input({}, [true, true, true]));
    const payload = toSavePayload(result);
    expect(payload.status).toBe('ok');
    for (const o of payload.options) {
      expect(o.memberDetails.map((d) => d.userId).sort()).toEqual(['m1', 'm2', 'org']);
    }
  });
});

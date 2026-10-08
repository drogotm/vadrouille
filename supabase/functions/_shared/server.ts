/**
 * Passage « base de données ↔ moteur », partagé par l'Edge Function et les tests e2e.
 * Aucune dépendance Deno ni Supabase ici : uniquement de la transformation de données.
 */
import type { Catalog } from './data/types.ts';
import { SEED_CATALOG } from './data/index.ts';
import { computeResults, normalizeAnswers, type EngineResult } from './engine/index.ts';

/** Forme renvoyée par la fonction SQL `get_compute_input`. */
export interface ComputeInput {
  vadrouille: {
    id: string;
    name: string;
    organizerId: string;
    weekends: string[];
    nights: number;
    expectedSize: number;
    status: 'collecting' | 'voting' | 'decided';
  };
  members: { userId: string; firstName: string; role: string; respondedAt: string | null }[];
  responses: { userId: string; answers: unknown }[];
}

export type ComputeGuard = 'ok' | 'not_member' | 'organizer_only' | 'already_decided';

/**
 * Qui peut lancer le calcul ? L'organisateur à tout moment (« forcer le calcul ») ;
 * n'importe quel membre dès que tout le monde a répondu.
 */
export function canCompute(input: ComputeInput, callerId: string): ComputeGuard {
  const caller = input.members.find((m) => m.userId === callerId);
  if (!caller) return 'not_member';
  if (input.vadrouille.status === 'decided') return 'already_decided';
  const everyoneAnswered = input.members.every((m) => m.respondedAt !== null);
  if (input.vadrouille.organizerId !== callerId && !everyoneAnswered) return 'organizer_only';
  return 'ok';
}

export function runEngine(input: ComputeInput, catalog: Catalog = SEED_CATALOG): EngineResult {
  const weekends = input.vadrouille.weekends;
  const memberIds = new Set(input.members.map((m) => m.userId));
  return computeResults(
    {
      weekends,
      nights: input.vadrouille.nights,
      members: input.responses
        .filter((r) => memberIds.has(r.userId))
        .map((r) => ({ userId: r.userId, answers: normalizeAnswers(r.answers, weekends) })),
    },
    catalog,
  );
}

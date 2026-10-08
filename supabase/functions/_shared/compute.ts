/**
 * Orchestration du calcul côté serveur, indépendante du transport (Edge Function, tests, démo) :
 * permissions, validation des réponses, appel du moteur, mise en forme pour save_results().
 */
import { decide } from './engine/decide.ts';
import type { Catalog, DecisionResult, MemberOptionDetails, OptionPublicData } from './engine/types.ts';
import { parseAnswers } from './engine/validate.ts';

/** Forme renvoyée par la fonction SQL get_compute_input(). */
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
  members: { userId: string; firstName: string; role: 'organizer' | 'member'; respondedAt: string | null }[];
  responses: { userId: string; answers: unknown }[];
}

export type Permission = { allowed: true } | { allowed: false; reason: string };

/**
 * L'organisateur peut lancer (ou forcer) le calcul à tout moment dès qu'une réponse existe.
 * Un membre ne peut le déclencher que si TOUT le monde a répondu et que le groupe est au complet.
 */
export function computePermission(input: ComputeInput, callerId: string): Permission {
  const me = input.members.find((m) => m.userId === callerId);
  if (!me) return { allowed: false, reason: 'not_a_member' };
  if (input.vadrouille.status === 'decided') return { allowed: false, reason: 'already_decided' };
  if (input.responses.length === 0) return { allowed: false, reason: 'no_answers' };
  if (callerId === input.vadrouille.organizerId) return { allowed: true };
  const everyoneAnswered = input.members.every((m) => m.respondedAt !== null);
  const groupComplete = input.members.length >= input.vadrouille.expectedSize;
  return everyoneAnswered && groupComplete ? { allowed: true } : { allowed: false, reason: 'not_allowed' };
}

export interface SavePayload {
  status: DecisionResult['status'];
  engineVersion: string;
  respondents: number;
  weekendStart: string | null;
  summary: DecisionResult['summary'];
  options: {
    kind: string;
    position: number;
    destinationId: string;
    weekendStart: string;
    comfort: string;
    matchScore: number;
    publicData: OptionPublicData;
    memberDetails: { userId: string; details: MemberOptionDetails }[];
  }[];
}

export function runCompute(input: ComputeInput, catalog?: Catalog) {
  const memberIds = new Set(input.members.map((m) => m.userId));
  const invalid: string[] = [];
  const members = [];
  for (const r of input.responses) {
    if (!memberIds.has(r.userId)) continue;
    const answers = parseAnswers(r.answers, input.vadrouille.weekends);
    if (answers) members.push({ id: r.userId, answers });
    else invalid.push(r.userId);
  }
  const result = decide({
    weekends: input.vadrouille.weekends,
    nights: input.vadrouille.nights,
    members,
    totalMembers: input.members.length,
    catalog,
  });
  return { result, invalidResponses: invalid };
}

export function toSavePayload(result: DecisionResult): SavePayload {
  return {
    status: result.status,
    engineVersion: result.engineVersion,
    respondents: result.respondents,
    weekendStart: result.weekendStart,
    summary: result.summary,
    options: result.options.map((o) => ({
      kind: o.kind,
      position: o.position,
      destinationId: o.destinationId,
      weekendStart: o.weekendStart,
      comfort: o.comfort,
      matchScore: o.matchScore,
      publicData: o.publicData,
      memberDetails: o.memberDetails.map((d) => ({ userId: d.memberId, details: d.details })),
    })),
  };
}

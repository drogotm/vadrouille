/**
 * Backend de DÉMONSTRATION : tout reste sur l'appareil (AsyncStorage), rien n'est envoyé.
 * Il reproduit le comportement du serveur (mêmes règles que les fonctions SQL, même moteur,
 * même séparation public / privé) pour parcourir toute l'app sans projet Supabase.
 * Les « amis » y sont simulés à partir des personas.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { computePermission, runCompute, toSavePayload, type Answers, type MemberOptionDetails } from '@/engine';
import { defaultAnswers, PERSONAS } from '@/lib/demo/personas';
import { AppError } from '@/lib/errors';

import type { Backend, Member, OptionInfo, Session, Vadrouille, VadrouilleState } from './types';

const KEY = 'vadrouille.demo.v2';

interface StoredOption extends OptionInfo {
  memberDetails: Record<string, MemberOptionDetails>;
}

interface StoredVadrouille {
  vadrouille: Vadrouille;
  members: Member[];
  responses: Record<string, Answers>;
  result: VadrouilleState['result'];
  options: StoredOption[];
  votes: Record<string, string>;
  createdAt: number;
}

interface Store {
  user: Session | null;
  vadrouilles: Record<string, StoredVadrouille>;
}

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const newInviteCode = () => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

export function createDemoBackend(): Backend {
  let cache: Store | null = null;

  const load = async (): Promise<Store> => {
    if (cache) return cache;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      cache = raw ? (JSON.parse(raw) as Store) : { user: null, vadrouilles: {} };
    } catch {
      cache = { user: null, vadrouilles: {} };
    }
    return cache;
  };
  const save = async () => {
    if (cache) await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
  };
  const me = async (): Promise<Session> => {
    const user = (await load()).user;
    if (!user) throw new AppError('not_authenticated');
    return user;
  };
  const get = async (id: string): Promise<StoredVadrouille> => {
    const v = (await load()).vadrouilles[id];
    if (!v) throw new AppError('not_a_member');
    return v;
  };
  const byCode = async (code: string) =>
    Object.values((await load()).vadrouilles).find((x) => x.vadrouille.inviteCode === code.toLowerCase());

  /** Même règle que la fonction SQL finalize_vote : votes, puis Match Score, puis position. */
  const finalize = (v: StoredVadrouille) => {
    const count = (id: string) => Object.values(v.votes).filter((o) => o === id).length;
    const winner = [...v.options].sort(
      (a, b) => count(b.id) - count(a.id) || b.matchScore - a.matchScore || a.position - b.position,
    )[0];
    if (!winner) return;
    v.vadrouille.status = 'decided';
    v.vadrouille.decidedOptionId = winner.id;
  };

  return {
    mode: 'demo',

    async getSession() {
      return (await load()).user;
    },

    async signIn(firstName) {
      const store = await load();
      const name = firstName.trim();
      store.user = store.user
        ? { ...store.user, firstName: name }
        : { userId: uuid(), firstName: name, email: null, isAnonymous: true };
      for (const v of Object.values(store.vadrouilles)) {
        for (const m of v.members) if (m.userId === store.user.userId) m.firstName = name;
      }
      await save();
      return store.user;
    },

    async signOut() {
      cache = { user: null, vadrouilles: {} };
      await save();
    },

    async sendEmailCode() {
      throw new AppError('demo_no_email', 'La sauvegarde par email n’existe pas en mode démo.');
    },
    async verifyEmailCode() {
      throw new AppError('demo_no_email', 'La sauvegarde par email n’existe pas en mode démo.');
    },

    async listMine() {
      const store = await load();
      return Object.values(store.vadrouilles)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((v) => v.vadrouille);
    },

    async create({ name, weekends, expectedSize }) {
      const user = await me();
      const sorted = [...new Set(weekends)].sort();
      if (sorted.length < 2 || sorted.length > 4) throw new AppError('invalid_weekends');
      const vadrouille: Vadrouille = {
        id: uuid(),
        name: name.trim(),
        organizerId: user.userId,
        weekends: sorted,
        nights: 2,
        expectedSize,
        inviteCode: newInviteCode(),
        status: 'collecting',
        decidedOptionId: null,
      };
      (await load()).vadrouilles[vadrouille.id] = {
        vadrouille,
        members: [{ userId: user.userId, firstName: user.firstName ?? 'Moi', role: 'organizer', respondedAt: null }],
        responses: {},
        result: null,
        options: [],
        votes: {},
        createdAt: Date.now(),
      };
      await save();
      return vadrouille;
    },

    async getInvite(code) {
      const user = (await load()).user;
      const v = await byCode(code);
      if (!v) return null;
      return {
        vadrouilleId: v.vadrouille.id,
        name: v.vadrouille.name,
        organizerFirstName: v.members.find((m) => m.role === 'organizer')?.firstName ?? '',
        weekends: v.vadrouille.weekends,
        nights: v.vadrouille.nights,
        memberCount: v.members.length,
        status: v.vadrouille.status,
        isMember: !!user && v.members.some((m) => m.userId === user.userId),
      };
    },

    async join(code) {
      const user = await me();
      const v = await byCode(code);
      if (!v) throw new AppError('invite_not_found');
      if (!v.members.some((m) => m.userId === user.userId)) {
        v.members.push({ userId: user.userId, firstName: user.firstName ?? 'Moi', role: 'member', respondedAt: null });
        await save();
      }
    },

    async getState(code) {
      const user = (await load()).user;
      const v = await byCode(code);
      if (!user || !v || !v.members.some((m) => m.userId === user.userId)) return null;
      const tally: Record<string, number> = {};
      for (const o of v.options) tally[o.id] = Object.values(v.votes).filter((x) => x === o.id).length;
      // comme avec les politiques RLS : on ne sort QUE ce que ce membre a le droit de voir
      return {
        vadrouille: { ...v.vadrouille },
        members: v.members.map((m) => ({ ...m })),
        meId: user.userId,
        isOrganizer: v.vadrouille.organizerId === user.userId,
        myAnswers: v.responses[user.userId] ?? null,
        result: v.result,
        options: v.options.map(({ memberDetails: _private, ...publicOption }) => publicOption),
        myDetails: Object.fromEntries(
          v.options.filter((o) => o.memberDetails[user.userId]).map((o) => [o.id, o.memberDetails[user.userId]]),
        ),
        myVote: v.votes[user.userId] ?? null,
        tally,
      };
    },

    async saveAnswers(vadrouilleId, answers) {
      const user = await me();
      const v = await get(vadrouilleId);
      if (v.vadrouille.status !== 'collecting') throw new AppError('answers_locked');
      v.responses[user.userId] = answers;
      const member = v.members.find((m) => m.userId === user.userId);
      if (member) member.respondedAt = new Date().toISOString();
      await save();
    },

    async compute(vadrouilleId) {
      const user = await me();
      const v = await get(vadrouilleId);
      const input = {
        vadrouille: { ...v.vadrouille },
        members: v.members,
        responses: Object.entries(v.responses).map(([userId, answers]) => ({ userId, answers })),
      };
      const permission = computePermission(input, user.userId);
      if (!permission.allowed) throw new AppError(permission.reason);
      const payload = toSavePayload(runCompute(input).result);
      v.votes = {};
      v.vadrouille.decidedOptionId = null;
      v.result = {
        status: payload.status,
        respondents: payload.respondents,
        weekendStart: payload.weekendStart,
        summary: payload.summary,
      };
      v.options = payload.options.map((o) => ({
        id: uuid(),
        kind: o.kind as OptionInfo['kind'],
        position: o.position,
        destinationId: o.destinationId,
        weekendStart: o.weekendStart,
        comfort: o.comfort as OptionInfo['comfort'],
        matchScore: o.matchScore,
        publicData: o.publicData,
        memberDetails: Object.fromEntries(o.memberDetails.map((m) => [m.userId, m.details])),
      }));
      v.vadrouille.status = payload.status === 'ok' ? 'voting' : 'collecting';
      await save();
      return payload.status;
    },

    async vote(optionId) {
      const user = await me();
      const v = Object.values((await load()).vadrouilles).find((x) => x.options.some((o) => o.id === optionId));
      if (!v) throw new AppError('option_not_found');
      if (v.vadrouille.status !== 'voting') throw new AppError('vote_closed');
      v.votes[user.userId] = optionId;
      // les amis fictifs votent pour l'option qui les arrange le plus
      for (const m of v.members) {
        if (m.userId === user.userId || v.votes[m.userId]) continue;
        const favourite = [...v.options].sort(
          (a, b) =>
            (b.memberDetails[m.userId]?.score ?? 0) - (a.memberDetails[m.userId]?.score ?? 0) ||
            a.position - b.position,
        )[0];
        if (favourite) v.votes[m.userId] = favourite.id;
      }
      if (Object.keys(v.votes).length >= v.members.length) finalize(v);
      await save();
    },

    async closeVote(vadrouilleId) {
      const user = await me();
      const v = await get(vadrouilleId);
      if (v.vadrouille.organizerId !== user.userId) throw new AppError('organizer_only');
      if (v.vadrouille.status !== 'voting') throw new AppError('vote_not_open');
      finalize(v);
      await save();
    },

    async reopen(vadrouilleId) {
      const user = await me();
      const v = await get(vadrouilleId);
      if (v.vadrouille.organizerId !== user.userId) throw new AppError('organizer_only');
      v.votes = {};
      v.options = [];
      v.result = null;
      v.vadrouille.status = 'collecting';
      v.vadrouille.decidedOptionId = null;
      await save();
    },

    async demoAddFriends(vadrouilleId) {
      const v = await get(vadrouilleId);
      const now = new Date().toISOString();
      const taken = new Set(v.members.map((m) => m.firstName));
      const missing = Math.max(1, v.vadrouille.expectedSize - v.members.length);
      for (const persona of PERSONAS.filter((p) => !taken.has(p.firstName)).slice(0, missing)) {
        const userId = uuid();
        v.members.push({ userId, firstName: persona.firstName, role: 'member', respondedAt: now });
        v.responses[userId] = persona.answers(v.vadrouille.weekends);
      }
      // ceux qui avaient rejoint sans répondre répondent aussi
      for (const m of v.members) {
        if (m.role !== 'organizer' && !m.respondedAt) {
          m.respondedAt = now;
          v.responses[m.userId] ??= defaultAnswers(v.vadrouille.weekends);
        }
      }
      await save();
    },
  };
}

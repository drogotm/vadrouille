import type { SupabaseClient, User } from '@supabase/supabase-js';

import { parseAnswers, type MemberOptionDetails, type OptionPublicData, type PublicSummary } from '@/engine';
import { AppError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

import type { Backend, InvitePreview, Member, OptionInfo, Session, Vadrouille, VadrouilleState } from './types';

type Row = Record<string, any>;

const toVadrouille = (r: Row): Vadrouille => ({
  id: r.id,
  name: r.name,
  organizerId: r.organizer_id,
  weekends: r.weekends,
  nights: r.nights,
  expectedSize: r.expected_size,
  inviteCode: r.invite_code,
  status: r.status,
  decidedOptionId: r.decided_option_id,
});

/** Backend réel : toutes les lectures passent par les politiques RLS, le calcul par l'Edge Function. */
export function createSupabaseBackend(): Backend {
  const db: SupabaseClient = getSupabase();

  const ok = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new AppError(res.error.message);
    return res.data;
  };

  const toSession = async (user: User): Promise<Session> => {
    const profile = ok(await db.from('profiles').select('first_name').eq('id', user.id).maybeSingle());
    return {
      userId: user.id,
      firstName: profile?.first_name ?? null,
      email: user.email ?? null,
      isAnonymous: user.is_anonymous ?? !user.email,
    };
  };

  const currentUser = async (): Promise<User | null> => (await db.auth.getSession()).data.session?.user ?? null;

  return {
    mode: 'supabase',

    async getSession() {
      const user = await currentUser();
      return user ? toSession(user) : null;
    },

    async signIn(firstName) {
      let user = await currentUser();
      if (!user) {
        const res = await db.auth.signInAnonymously();
        if (res.error || !res.data.user) throw new AppError(res.error?.message ?? 'not_authenticated');
        user = res.data.user;
      }
      ok(await db.from('profiles').upsert({ id: user.id, first_name: firstName.trim() }));
      return toSession(user);
    },

    async signOut() {
      await db.auth.signOut();
    },

    async sendEmailCode(email, mode) {
      const res =
        mode === 'link'
          ? await db.auth.updateUser({ email })
          : await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (res.error) throw new AppError(res.error.message);
    },

    async verifyEmailCode(email, code, mode) {
      const res = await db.auth.verifyOtp({ email, token: code, type: mode === 'link' ? 'email_change' : 'email' });
      if (res.error || !res.data.user) throw new AppError(res.error?.message ?? 'Token has expired or is invalid');
      return toSession(res.data.user);
    },

    async listMine() {
      const rows = ok(await db.from('vadrouilles').select('*').order('created_at', { ascending: false }));
      return (rows ?? []).map(toVadrouille);
    },

    async create({ name, weekends, expectedSize }) {
      const row = ok(
        await db.rpc('create_vadrouille', { p_name: name, p_weekends: weekends, p_expected_size: expectedSize }),
      );
      return toVadrouille(row);
    },

    async getInvite(code) {
      const rows = ok(await db.rpc('get_invite', { p_code: code })) as Row[] | null;
      const r = rows?.[0];
      if (!r) return null;
      const preview: InvitePreview = {
        vadrouilleId: r.vadrouille_id,
        name: r.name,
        organizerFirstName: r.organizer_first_name,
        weekends: r.weekends,
        nights: r.nights,
        memberCount: r.member_count,
        status: r.status,
        isMember: r.is_member,
      };
      return preview;
    },

    async join(code) {
      ok(await db.rpc('join_vadrouille', { p_code: code }));
    },

    async getState(code) {
      const user = await currentUser();
      if (!user) return null;
      const v = ok(await db.from('vadrouilles').select('*').eq('invite_code', code.toLowerCase()).maybeSingle());
      if (!v) return null;
      const vadrouille = toVadrouille(v);
      const [members, mine, result, options, details, vote, tally] = await Promise.all([
        db.from('members').select('*').eq('vadrouille_id', v.id).order('joined_at'),
        db.from('responses').select('answers').eq('vadrouille_id', v.id).eq('user_id', user.id).maybeSingle(),
        db.from('results').select('*').eq('vadrouille_id', v.id).maybeSingle(),
        db.from('result_options').select('*').eq('vadrouille_id', v.id).order('position'),
        db.from('result_member_details').select('option_id, details').eq('vadrouille_id', v.id).eq('user_id', user.id),
        db.from('votes').select('option_id').eq('vadrouille_id', v.id).eq('user_id', user.id).maybeSingle(),
        db.rpc('vote_tally', { p_vadrouille_id: v.id }),
      ]);
      const resultRow = ok(result);
      const mineRow = ok(mine);
      const state: VadrouilleState = {
        vadrouille,
        members: (ok(members) ?? []).map(
          (m: Row): Member => ({
            userId: m.user_id,
            firstName: m.first_name,
            role: m.role,
            respondedAt: m.responded_at,
          }),
        ),
        meId: user.id,
        isOrganizer: vadrouille.organizerId === user.id,
        myAnswers: mineRow ? parseAnswers(mineRow.answers, vadrouille.weekends) : null,
        result: resultRow
          ? {
              status: resultRow.status,
              respondents: resultRow.respondents,
              weekendStart: resultRow.weekend_start,
              summary: resultRow.summary as PublicSummary,
            }
          : null,
        options: (ok(options) ?? []).map(
          (o: Row): OptionInfo => ({
            id: o.id,
            kind: o.kind,
            position: o.position,
            destinationId: o.destination_id,
            weekendStart: o.weekend_start,
            comfort: o.comfort,
            matchScore: o.match_score,
            publicData: o.public_data as OptionPublicData,
          }),
        ),
        myDetails: Object.fromEntries(
          (ok(details) ?? []).map((d: Row) => [d.option_id as string, d.details as MemberOptionDetails]),
        ),
        myVote: ok(vote)?.option_id ?? null,
        tally: Object.fromEntries(((ok(tally) as Row[] | null) ?? []).map((t) => [t.option_id as string, t.votes as number])),
      };
      return state;
    },

    async saveAnswers(vadrouilleId, answers) {
      const user = await currentUser();
      if (!user) throw new AppError('not_authenticated');
      ok(
        await db
          .from('responses')
          .upsert({ vadrouille_id: vadrouilleId, user_id: user.id, answers }, { onConflict: 'vadrouille_id,user_id' }),
      );
    },

    async compute(vadrouilleId) {
      const { data, error } = await db.functions.invoke('compute-results', { body: { vadrouilleId } });
      if (error) {
        // l'Edge Function renvoie { error: code } avec un statut HTTP d'erreur
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new AppError(body?.error ?? error.message);
      }
      return data.status;
    },

    async vote(optionId) {
      ok(await db.rpc('cast_vote', { p_option_id: optionId }));
    },

    async closeVote(vadrouilleId) {
      ok(await db.rpc('close_vote', { p_vadrouille_id: vadrouilleId }));
    },

    async reopen(vadrouilleId) {
      ok(await db.rpc('reopen_vadrouille', { p_vadrouille_id: vadrouilleId }));
    },
  };
}

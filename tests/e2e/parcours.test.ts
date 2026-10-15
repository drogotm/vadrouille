/**
 * Parcours complet avec un groupe fictif de 5 personnes, sur un vrai Postgres (PGlite) avec
 * nos migrations et nos politiques RLS, et le même code serveur que l'Edge Function :
 * création → invitation → questionnaire privé → suivi → calcul → vote → plan individuel.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  DecisionResult,
  MemberOptionDetails,
  OptionPublicData,
  PublicSummary,
} from '../../supabase/functions/_shared/engine/index.ts';
import {
  computePermission,
  type ComputeInput,
  runCompute,
  toSavePayload,
} from '../../supabase/functions/_shared/compute.ts';
import { getDestination } from '../../supabase/functions/_shared/engine/catalog.ts';
import { createTestDb, sampleAnswers, upcomingFridays, type TestDb } from '../db/harness';

let db: TestDb;
const weekends = upcomingFridays(3);
const ids: Record<string, string> = {};
let vadrouilleId = '';
let inviteCode = '';

const BANDE: Record<string, Record<string, unknown>> = {
  Léa: { departureCity: 'paris', budgetMax: 350, envies: ['gastronomie', 'fete'], cadres: ['ville', 'mer'] },
  Max: { departureCity: 'paris', budgetMax: 260, envies: ['gastronomie', 'fete'], cadres: ['ville'], importance: { budget: 'indispensable' } },
  Inès: { departureCity: 'lyon', budgetMax: 420, envies: ['gastronomie', 'culture'], cadres: ['ville'], maxTravelHours: 5 },
  Tom: { departureCity: 'nantes', budgetMax: 300, envies: ['fete', 'sport'], cadres: ['mer', 'ville'], maxTravelHours: 5 },
  Jade: { departureCity: 'bordeaux', budgetMax: 320, envies: ['gastronomie', 'nature'], cadres: ['ville', 'campagne'] },
};

/** Ce que fait l'Edge Function compute-results, clé service_role comprise. */
async function serverCompute(callerId: string): Promise<DecisionResult | string> {
  const row = await db.service.one<{ input: ComputeInput }>(
    `select public.get_compute_input($1) as input`,
    [vadrouilleId],
  );
  const permission = computePermission(row.input, callerId);
  if (!permission.allowed) return permission.reason;
  const { result } = runCompute(row.input);
  await db.service.query(`select public.save_results($1, $2::jsonb)`, [
    vadrouilleId,
    JSON.stringify(toSavePayload(result)),
  ]);
  return result;
}

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('parcours complet — 5 amis', () => {
  it('1. Léa crée la Vadrouille et obtient un code d’invitation', async () => {
    ids['Léa'] = await db.createUser('Léa');
    const v = await db.as(ids['Léa']).one<{ id: string; invite_code: string; status: string }>(
      `select id, invite_code, status from public.create_vadrouille($1, $2::date[], $3)`,
      ['Les 30 ans de Max', weekends, 5],
    );
    vadrouilleId = v.id;
    inviteCode = v.invite_code;
    expect(v.status).toBe('collecting');
  });

  it('2. les 4 invités voient l’aperçu puis rejoignent via le lien', async () => {
    const preview = await db.anon.one<{ name: string; organizer_first_name: string }>(
      `select * from public.get_invite($1)`,
      [inviteCode],
    );
    expect(preview).toMatchObject({ name: 'Les 30 ans de Max', organizer_first_name: 'Léa' });
    for (const name of ['Max', 'Inès', 'Tom', 'Jade']) {
      ids[name] = await db.createUser(name);
      await db.as(ids[name]).query(`select public.join_vadrouille($1)`, [inviteCode]);
    }
    const members = await db.as(ids['Tom']).query(`select * from public.members where vadrouille_id = $1`, [vadrouilleId]);
    expect(members).toHaveLength(5);
  });

  it('3. chacun répond en privé ; le suivi montre qui a répondu, pas quoi', async () => {
    for (const name of ['Léa', 'Max', 'Inès', 'Tom']) {
      await db.as(ids[name]).query(
        `insert into public.responses (vadrouille_id, answers) values ($1, $2::jsonb)`,
        [vadrouilleId, JSON.stringify(sampleAnswers(weekends, BANDE[name]))],
      );
    }
    const suivi = await db.as(ids['Léa']).query<{ first_name: string; responded_at: string | null }>(
      `select first_name, responded_at from public.members where vadrouille_id = $1`,
      [vadrouilleId],
    );
    expect(suivi.filter((m) => m.responded_at).map((m) => m.first_name).sort()).toEqual(['Inès', 'Léa', 'Max', 'Tom']);
    // l'organisatrice ne lit que SA réponse
    const lisibles = await db.as(ids['Léa']).query<{ user_id: string }>(`select user_id from public.responses`);
    expect(lisibles.map((r) => r.user_id)).toEqual([ids['Léa']]);
  });

  it('4. tant que Jade n’a pas répondu, seul l’organisateur peut forcer le calcul', async () => {
    expect(await serverCompute(ids['Tom'])).toBe('not_allowed');
    expect(await serverCompute(await db.createUser('Intrus'))).toBe('not_a_member');
    await db.as(ids['Jade']).query(
      `insert into public.responses (vadrouille_id, answers) values ($1, $2::jsonb)`,
      [vadrouilleId, JSON.stringify(sampleAnswers(weekends, BANDE['Jade']))],
    );
  });

  it('5. le calcul serveur produit 3 options expliquées', async () => {
    const result = (await serverCompute(ids['Tom'])) as DecisionResult; // tout le monde a répondu
    expect(result.status).toBe('ok');

    const v = await db.as(ids['Max']).one<{ status: string }>(`select status from public.vadrouilles where id = $1`, [vadrouilleId]);
    expect(v.status).toBe('voting');
    const options = await db.as(ids['Max']).query<{ kind: string; match_score: number; public_data: OptionPublicData }>(
      `select kind, match_score, public_data from public.result_options where vadrouille_id = $1 order by position`,
      [vadrouilleId],
    );
    expect(options.map((o) => o.kind)).toEqual(['best', 'budget', 'wild']);
    for (const o of options) {
      expect(o.public_data.headline).toContain(`${o.match_score} % Match`);
      expect(o.public_data.highlights[0]).toMatch(/^\d\/5 respectent leur budget$/);
      // rien d'individuel dans ce que tout le groupe peut lire
      const publicJson = JSON.stringify(o.public_data);
      for (const id of Object.values(ids)) expect(publicJson).not.toContain(id);
      expect(publicJson).not.toContain('budgetMax');
    }
  });

  it('6. chacun ne voit que SON budget prévisionnel, et celui de Max tient dans son max', async () => {
    for (const name of Object.keys(BANDE)) {
      const rows = await db.as(ids[name]).query<{ user_id: string; details: MemberOptionDetails }>(
        `select user_id, details from public.result_member_details where vadrouille_id = $1`,
        [vadrouilleId],
      );
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.user_id === ids[name])).toBe(true);
      for (const r of rows) {
        expect(r.details.budgetMax).toBe(BANDE[name].budgetMax);
        expect(r.details.total).toBe(
          (r.details.transport?.cost ?? 0) + r.details.lodging + r.details.food + r.details.activities,
        );
        if (name === 'Max') expect(r.details.total).toBeLessThanOrEqual(260); // budget indispensable
      }
    }
  });

  it('7. le groupe vote, peut changer d’avis, et l’orga clôt le vote', async () => {
    const options = await db.as(ids['Léa']).query<{ id: string; kind: string }>(
      `select id, kind from public.result_options where vadrouille_id = $1 order by position`,
      [vadrouilleId],
    );
    const [best, budget] = options;
    const votes: Record<string, string> = { Léa: best.id, Max: budget.id, Inès: best.id, Tom: best.id, Jade: budget.id };
    for (const name of ['Léa', 'Max', 'Inès', 'Tom']) {
      await db.as(ids[name]).query(`select public.cast_vote($1)`, [votes[name]]);
    }
    const tally = await db.as(ids['Jade']).query<{ option_id: string; votes: number }>(
      `select * from public.vote_tally($1)`,
      [vadrouilleId],
    );
    expect(tally.map((t) => t.votes)).toEqual([3, 1, 0]);
    let v = await db.as(ids['Jade']).one<{ status: string }>(`select status from public.vadrouilles where id = $1`, [vadrouilleId]);
    expect(v.status).toBe('voting');

    await db.as(ids['Jade']).query(`select public.cast_vote($1)`, [votes['Jade']]);
    // tout le monde a voté : le vote reste ouvert, et on peut encore changer d'avis
    v = await db.as(ids['Jade']).one<{ status: string }>(`select status from public.vadrouilles where id = $1`, [vadrouilleId]);
    expect(v.status).toBe('voting');
    await db.as(ids['Max']).query(`select public.cast_vote($1)`, [best.id]);
    const after = await db.as(ids['Jade']).query<{ votes: number }>(`select * from public.vote_tally($1)`, [vadrouilleId]);
    expect(after.map((t) => t.votes)).toEqual([4, 1, 0]);

    // seule l'orga clôt le vote
    await db.as(ids['Léa']).query(`select public.close_vote($1)`, [vadrouilleId]);
    const decided = await db.as(ids['Jade']).one<{ status: string; decided_option_id: string }>(
      `select status, decided_option_id from public.vadrouilles where id = $1`,
      [vadrouilleId],
    );
    expect(decided).toMatchObject({ status: 'decided', decided_option_id: best.id });
    // un vote tardif est refusé, un recalcul aussi
    await expect(db.as(ids['Max']).query(`select public.cast_vote($1)`, [best.id])).rejects.toThrow(/vote_closed/);
    expect(await serverCompute(ids['Léa'])).toBe('already_decided');
  });

  it('8. le plan du séjour : destination gagnante + budget individuel de chacun', async () => {
    const plan = await db.as(ids['Tom']).one<{
      public_data: OptionPublicData;
      destination_id: string;
      details: MemberOptionDetails;
    }>(
      `select o.public_data, o.destination_id, d.details
         from public.vadrouilles v
         join public.result_options o on o.id = v.decided_option_id
         join public.result_member_details d on d.option_id = o.id
        where v.id = $1`,
      [vadrouilleId],
    );
    expect(plan.public_data.suggestions.activities.length).toBeGreaterThanOrEqual(2);
    expect(plan.public_data.suggestions.restaurants.length).toBeGreaterThanOrEqual(2);
    // Tom part de Nantes : un transport, sauf si la Vadrouille est… à Nantes
    const homeTrip = getDestination(plan.destination_id)?.homeCity === 'nantes';
    expect(plan.details.transport === null).toBe(homeTrip);
    expect(plan.details.total).toBeGreaterThan(0);
  });
});

describe('groupe bloqué puis débloqué', () => {
  it('aucune option faisable → diagnostic, collecte rouverte, puis résultat après assouplissement', async () => {
    const lea = await db.createUser('Léa');
    const v = await db.as(lea).one<{ id: string; invite_code: string }>(
      `select id, invite_code from public.create_vadrouille($1, $2::date[], $3)`,
      ['Mission impossible', weekends, 4],
    );
    const users = [lea];
    for (const name of ['A', 'B', 'C']) {
      const u = await db.createUser(name);
      await db.as(u).query(`select public.join_vadrouille($1)`, [v.invite_code]);
      users.push(u);
    }
    for (const u of users) {
      await db.as(u).query(`insert into public.responses (vadrouille_id, answers) values ($1, $2::jsonb)`, [
        v.id,
        JSON.stringify(sampleAnswers(weekends, { budgetMax: 50, importance: { budget: 'indispensable' } })),
      ]);
    }
    const compute = async () => {
      const row = await db.service.one<{ input: ComputeInput }>(`select public.get_compute_input($1) as input`, [v.id]);
      const { result } = runCompute(row.input);
      await db.service.query(`select public.save_results($1, $2::jsonb)`, [
        v.id,
        JSON.stringify(toSavePayload(result)),
      ]);
      return result;
    };
    expect((await compute()).status).toBe('no_feasible');
    const stored = await db.as(users[1]).one<{ status: string; summary: PublicSummary }>(
      `select status, summary from public.results where vadrouille_id = $1`,
      [v.id],
    );
    expect(stored.status).toBe('no_feasible');
    expect(stored.summary.blocking[0].criterion).toBe('budget');
    // la collecte reste ouverte : chacun peut assouplir
    for (const u of users) {
      await db.as(u).query(
        `update public.responses set answers = jsonb_set(answers, '{budgetMax}', '400') where vadrouille_id = $1`,
        [v.id],
      );
    }
    expect((await compute()).status).toBe('ok');
  });
});

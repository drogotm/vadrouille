/**
 * Confidentialité : ces tests prouvent, sur un vrai Postgres avec nos migrations, que
 * personne (organisateur compris) ne peut lire les réponses ou le budget d'un autre membre.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, sampleAnswers, setupGroup, type TestDb } from './harness';

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

async function answer(userId: string, vadrouilleId: string, weekends: string[], overrides = {}) {
  await db.as(userId).query(
    `insert into public.responses (vadrouille_id, answers) values ($1, $2::jsonb)`,
    [vadrouilleId, JSON.stringify(sampleAnswers(weekends, overrides))],
  );
}

/** Résultat minimal tel que l'Edge Function l'enregistre (via service_role). */
function fakeResult(memberIds: string[], weekend: string) {
  return {
    status: 'ok',
    engineVersion: 'test',
    respondents: memberIds.length,
    weekendStart: weekend,
    summary: {},
    options: [
      {
        kind: 'best',
        position: 1,
        destinationId: 'bordeaux',
        weekendStart: weekend,
        comfort: 'confortable',
        matchScore: 90,
        publicData: { lines: ['6/7 voulaient gastronomie'] },
        memberDetails: memberIds.map((userId, i) => ({
          userId,
          details: { totalCost: 200 + i * 10, transport: { mode: 'train', minutes: 120 } },
        })),
      },
      {
        kind: 'budget',
        position: 2,
        destinationId: 'lille',
        weekendStart: weekend,
        comfort: 'roots',
        matchScore: 80,
        publicData: {},
        memberDetails: memberIds.map((userId) => ({ userId, details: { totalCost: 150 } })),
      },
    ],
  };
}

describe('réponses individuelles', () => {
  it("un membre ne peut pas lire les réponses d'un autre membre", async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    const [max, ines] = g.members;
    await answer(max, g.vadrouilleId, g.weekends, { budgetMax: 180 });
    await answer(ines, g.vadrouilleId, g.weekends, { budgetMax: 650 });

    const seenByMax = await db.as(max).query<{ user_id: string; answers: { budgetMax: number } }>(
      `select user_id, answers from public.responses where vadrouille_id = $1`,
      [g.vadrouilleId],
    );
    expect(seenByMax).toHaveLength(1);
    expect(seenByMax[0].user_id).toBe(max);
    expect(seenByMax[0].answers.budgetMax).toBe(180);

    // même en ciblant explicitement la ligne d'Inès
    const targeted = await db.as(max).query(
      `select * from public.responses where user_id = $1`,
      [ines],
    );
    expect(targeted).toHaveLength(0);
  });

  it("l'organisateur ne peut pas lire les réponses des membres", async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    for (const m of g.members) await answer(m, g.vadrouilleId, g.weekends);

    const seenByOrganizer = await db
      .as(g.organizer)
      .query(`select * from public.responses where vadrouille_id = $1`, [g.vadrouilleId]);
    expect(seenByOrganizer).toHaveLength(0);

    // le service (Edge Function) voit bien les 2 réponses : elles existent
    const all = await db.service.query(`select * from public.responses where vadrouille_id = $1`, [
      g.vadrouilleId,
    ]);
    expect(all).toHaveLength(2);
  });

  it("un membre ne peut ni modifier ni supprimer la réponse d'un autre", async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    const [max, ines] = g.members;
    await answer(ines, g.vadrouilleId, g.weekends, { budgetMax: 650 });

    await db
      .as(max)
      .query(
        `update public.responses set answers = jsonb_set(answers, '{budgetMax}', '1') where user_id = $1`,
        [ines],
      );
    await db.as(max).query(`delete from public.responses where user_id = $1`, [ines]);

    const row = await db.service.one<{ answers: { budgetMax: number } }>(
      `select answers from public.responses where user_id = $1 and vadrouille_id = $2`,
      [ines, g.vadrouilleId],
    );
    expect(row.answers.budgetMax).toBe(650);
  });

  it("impossible d'écrire une réponse au nom d'un autre membre", async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    const [max, ines] = g.members;
    await expect(
      db
        .as(max)
        .query(
          `insert into public.responses (vadrouille_id, user_id, answers) values ($1, $2, $3::jsonb)`,
          [g.vadrouilleId, ines, JSON.stringify(sampleAnswers(g.weekends))],
        ),
    ).rejects.toThrow(/row-level security/);
  });

  it("un non-membre ne peut pas répondre à une Vadrouille", async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    const intrus = await db.createUser('Intrus');
    await expect(answer(intrus, g.vadrouilleId, g.weekends)).rejects.toThrow(/row-level security/);
  });

  it('une réponse mal formée est rejetée', async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    await expect(
      answer(g.members[0], g.vadrouilleId, g.weekends, { budgetMax: 'beaucoup' }),
    ).rejects.toThrow(/invalid_answers/);
    await expect(
      answer(g.members[0], g.vadrouilleId, g.weekends, { ambiance: 7 }),
    ).rejects.toThrow(/invalid_answers/);
  });

  it('les réponses sont figées une fois les résultats calculés', async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    const [max] = g.members;
    await answer(max, g.vadrouilleId, g.weekends, { budgetMax: 200 });
    await db.service.query(`select public.save_results($1, $2::jsonb)`, [
      g.vadrouilleId,
      JSON.stringify(fakeResult([g.organizer, max], g.weekends[0])),
    ]);

    await db
      .as(max)
      .query(
        `update public.responses set answers = jsonb_set(answers, '{budgetMax}', '900') where vadrouille_id = $1`,
        [g.vadrouilleId],
      )
      .catch(() => undefined);
    const own = await db
      .as(max)
      .one<{ answers: { budgetMax: number } }>(
        `select answers from public.responses where vadrouille_id = $1`,
        [g.vadrouilleId],
      );
    expect(own.answers.budgetMax).toBe(200);
  });
});

describe('suivi des réponses', () => {
  it('les co-membres voient QUI a répondu, jamais le contenu', async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    const [max] = g.members;
    await answer(max, g.vadrouilleId, g.weekends);

    const rows = await db.as(g.organizer).query<Record<string, unknown>>(
      `select * from public.members where vadrouille_id = $1 order by joined_at`,
      [g.vadrouilleId],
    );
    expect(rows).toHaveLength(3);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['first_name', 'joined_at', 'responded_at', 'role', 'user_id', 'vadrouille_id'].sort(),
    );
    const maxRow = rows.find((r) => r.user_id === max)!;
    expect(maxRow.responded_at).not.toBeNull();
    expect(rows.filter((r) => r.responded_at === null)).toHaveLength(2);
  });

  it('un membre ne peut pas modifier la table members (rôle, statut)', async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    const [max] = g.members;
    await expect(
      db
        .as(max)
        .query(`update public.members set role = 'organizer' where user_id = $1`, [max]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db
        .as(max)
        .query(`insert into public.members (vadrouille_id, user_id, first_name) values ($1, $2, 'X')`, [
          g.vadrouilleId,
          max,
        ]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('isolation entre groupes et visiteurs', () => {
  it('un non-membre ne voit ni la Vadrouille, ni ses membres, ni ses résultats', async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    await db.service.query(`select public.save_results($1, $2::jsonb)`, [
      g.vadrouilleId,
      JSON.stringify(fakeResult([g.organizer, ...g.members], g.weekends[0])),
    ]);
    const outsider = await db.createUser('Curieux');
    const c = db.as(outsider);
    expect(await c.query(`select * from public.vadrouilles where id = $1`, [g.vadrouilleId])).toHaveLength(0);
    expect(await c.query(`select * from public.members where vadrouille_id = $1`, [g.vadrouilleId])).toHaveLength(0);
    expect(await c.query(`select * from public.results where vadrouille_id = $1`, [g.vadrouilleId])).toHaveLength(0);
    expect(await c.query(`select * from public.result_options where vadrouille_id = $1`, [g.vadrouilleId])).toHaveLength(0);
    expect(await c.query(`select * from public.vote_tally($1)`, [g.vadrouilleId])).toHaveLength(0);
  });

  it("un visiteur anonyme ne lit aucune table mais peut prévisualiser une invitation", async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    await expect(db.anon.query(`select * from public.vadrouilles`)).rejects.toThrow(/permission denied/);
    await expect(db.anon.query(`select * from public.responses`)).rejects.toThrow(/permission denied/);
    await expect(db.anon.query(`select * from public.members`)).rejects.toThrow(/permission denied/);

    const invite = await db.anon.one<Record<string, unknown>>(`select * from public.get_invite($1)`, [
      g.inviteCode,
    ]);
    expect(invite.name).toBe('Week-end test');
    expect(invite.organizer_first_name).toBe('Léa');
    expect(invite.member_count).toBe(2);
    expect(invite.is_member).toBe(false);
    // l'aperçu n'expose aucune donnée de réponse
    expect(Object.keys(invite)).not.toContain('answers');
  });

  it('un code inconnu ne donne rien', async () => {
    expect(await db.anon.query(`select * from public.get_invite('inexistant')`)).toHaveLength(0);
    const u = await db.createUser('Max');
    await expect(db.as(u).query(`select public.join_vadrouille('inexistant')`)).rejects.toThrow(
      /invite_not_found/,
    );
  });
});

describe('résultats et votes', () => {
  it('le budget individuel calculé n’est lisible que par le membre concerné', async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    const everyone = [g.organizer, ...g.members];
    await db.service.query(`select public.save_results($1, $2::jsonb)`, [
      g.vadrouilleId,
      JSON.stringify(fakeResult(everyone, g.weekends[0])),
    ]);

    for (const uid of everyone) {
      const rows = await db.as(uid).query<{ user_id: string }>(
        `select * from public.result_member_details where vadrouille_id = $1`,
        [g.vadrouilleId],
      );
      expect(rows).toHaveLength(2); // une ligne par option, uniquement les siennes
      expect(rows.every((r) => r.user_id === uid)).toBe(true);
    }
    // les options publiques, elles, sont visibles par tous les membres
    const options = await db.as(g.members[0]).query(
      `select * from public.result_options where vadrouille_id = $1`,
      [g.vadrouilleId],
    );
    expect(options).toHaveLength(2);
  });

  it('les votes individuels sont privés ; seul le décompte est exposé', async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    await db.service.query(`select public.save_results($1, $2::jsonb)`, [
      g.vadrouilleId,
      JSON.stringify(fakeResult([g.organizer, ...g.members], g.weekends[0])),
    ]);
    const opts = await db
      .as(g.organizer)
      .query<{ id: string; kind: string }>(
        `select id, kind from public.result_options where vadrouille_id = $1 order by position`,
        [g.vadrouilleId],
      );
    const [max, ines] = g.members;
    await db.as(max).query(`select public.cast_vote($1)`, [opts[0].id]);
    await db.as(ines).query(`select public.cast_vote($1)`, [opts[1].id]);

    const visibleToOrganizer = await db.as(g.organizer).query(`select * from public.votes`);
    expect(visibleToOrganizer).toHaveLength(0);
    const ownVote = await db.as(max).query<{ option_id: string }>(`select * from public.votes`);
    expect(ownVote).toHaveLength(1);
    expect(ownVote[0].option_id).toBe(opts[0].id);

    const tally = await db
      .as(g.organizer)
      .query<{ option_id: string; votes: number }>(`select * from public.vote_tally($1)`, [
        g.vadrouilleId,
      ]);
    expect(tally.map((t) => t.votes)).toEqual([1, 1]);
  });

  it('seul l’organisateur peut clore le vote ou rouvrir la collecte', async () => {
    const g = await setupGroup(db, ['Léa', 'Max', 'Inès']);
    await db.service.query(`select public.save_results($1, $2::jsonb)`, [
      g.vadrouilleId,
      JSON.stringify(fakeResult([g.organizer, ...g.members], g.weekends[0])),
    ]);
    const [max] = g.members;
    await expect(db.as(max).query(`select public.close_vote($1)`, [g.vadrouilleId])).rejects.toThrow(
      /organizer_only/,
    );
    await expect(
      db.as(max).query(`select public.reopen_vadrouille($1)`, [g.vadrouilleId]),
    ).rejects.toThrow(/organizer_only/);

    const winner = await db
      .as(g.organizer)
      .one<{ close_vote: string }>(`select public.close_vote($1)`, [g.vadrouilleId]);
    const v = await db
      .as(max)
      .one<{ status: string; decided_option_id: string }>(
        `select status, decided_option_id from public.vadrouilles where id = $1`,
        [g.vadrouilleId],
      );
    expect(v.status).toBe('decided');
    expect(v.decided_option_id).toBe(winner.close_vote);
  });

  it('les fonctions serveur sont interdites aux clients', async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    const asOrganizer = db.as(g.organizer);
    await expect(
      asOrganizer.query(`select public.get_compute_input($1)`, [g.vadrouilleId]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asOrganizer.query(`select public.save_results($1, '{}'::jsonb)`, [g.vadrouilleId]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asOrganizer.query(`select public.finalize_vote($1)`, [g.vadrouilleId]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.anon.query(`select public.create_vadrouille('x', array['2030-01-04','2030-01-11']::date[], 4)`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('création et invitation', () => {
  it('crée une Vadrouille et inscrit l’organisateur', async () => {
    const g = await setupGroup(db, ['Léa']);
    const members = await db
      .as(g.organizer)
      .query<{ role: string; first_name: string }>(
        `select role, first_name from public.members where vadrouille_id = $1`,
        [g.vadrouilleId],
      );
    expect(members).toEqual([{ role: 'organizer', first_name: 'Léa' }]);
    expect(g.inviteCode).toMatch(/^[a-z2-9]{10}$/);
  });

  it('refuse moins de 2 ou plus de 4 week-ends', async () => {
    const u = await db.createUser('Léa');
    await expect(
      db.as(u).query(`select public.create_vadrouille('x', array['2030-01-04']::date[], 4)`),
    ).rejects.toThrow(/invalid_weekends/);
    await expect(
      db
        .as(u)
        .query(
          `select public.create_vadrouille('x', array['2030-01-04','2030-01-11','2030-01-18','2030-01-25','2030-02-01']::date[], 4)`,
        ),
    ).rejects.toThrow(/invalid_weekends/);
  });

  it('rejoindre est idempotent et nécessite un prénom', async () => {
    const g = await setupGroup(db, ['Léa', 'Max']);
    const [max] = g.members;
    await db.as(max).query(`select public.join_vadrouille($1)`, [g.inviteCode]);
    const count = await db
      .as(max)
      .one<{ n: number }>(`select count(*)::int as n from public.members where vadrouille_id = $1`, [
        g.vadrouilleId,
      ]);
    expect(count.n).toBe(2);

    // utilisateur sans profil
    const { randomUUID } = await import('node:crypto');
    const ghost = randomUUID();
    await db.pg.query(`insert into auth.users (id) values ($1)`, [ghost]);
    await expect(
      db.as(ghost).query(`select public.join_vadrouille($1)`, [g.inviteCode]),
    ).rejects.toThrow(/profile_required/);
  });
});

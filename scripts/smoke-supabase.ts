/**
 * Essai RÉEL du backend : joue le parcours complet d'un groupe de 5 sur le projet Supabase
 * désigné par .env (comptes anonymes, RLS, Edge Function compute-results, vote), puis supprime
 * la Vadrouille de test. Les 5 comptes anonymes créés restent dans Auth (sans données).
 *
 *   npm run smoke:supabase
 *
 * Complète les tests PGlite (tests/db) : ici on vérifie le vrai projet, pas une base embarquée.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { PERSONAS } from '../src/lib/demo/personas.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquantes dans .env');
  process.exit(1);
}

let step = 0;
const ok = (label: string) => console.log(`✅ ${++step}. ${label}`);
function check(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`ÉCHEC : ${label}`);
}
const data = <T>(res: { data: T; error: { message: string } | null }, label: string): T => {
  if (res.error) throw new Error(`ÉCHEC : ${label} — ${res.error.message}`);
  return res.data;
};

/** Les `count` prochains vendredis à partir d'aujourd'hui + 14 jours, au format AAAA-MM-JJ. */
function fridays(count: number): string[] {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 14);
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return Array.from({ length: count }, (_, i) => {
    const f = new Date(d);
    f.setUTCDate(d.getUTCDate() + 7 * i);
    return f.toISOString().slice(0, 10);
  });
}

interface Actor {
  firstName: string;
  db: SupabaseClient;
  userId: string;
}

async function signIn(firstName: string): Promise<Actor> {
  const db = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const res = await db.auth.signInAnonymously();
  if (res.error || !res.data.user) throw new Error(`ÉCHEC : connexion anonyme — ${res.error?.message}`);
  data(await db.from('profiles').upsert({ id: res.data.user.id, first_name: firstName }), 'profil');
  return { firstName, db, userId: res.data.user.id };
}

async function main() {
  const personas = PERSONAS.slice(0, 5);
  const actors: Actor[] = [];
  for (const p of personas) actors.push(await signIn(p.firstName));
  const [orga, ...guests] = actors;
  ok(`5 comptes anonymes créés (${actors.map((a) => a.firstName).join(', ')})`);

  const weekends = fridays(3);
  const vadrouille = data(
    await orga.db.rpc('create_vadrouille', { p_name: 'Essai réel', p_weekends: weekends, p_expected_size: 5 }),
    'création',
  ) as { id: string; invite_code: string };
  const id = vadrouille.id;
  ok(`Vadrouille créée par ${orga.firstName} (code ${vadrouille.invite_code})`);

  try {
    const stranger = createClient(url!, key!, { auth: { persistSession: false } });
    const preview = data(await stranger.rpc('get_invite', { p_code: vadrouille.invite_code }), 'aperçu') as unknown[];
    check(preview?.length === 1, "l'aperçu d'invitation est lisible avant connexion");
    for (const g of guests) data(await g.db.rpc('join_vadrouille', { p_code: vadrouille.invite_code }), 'rejoindre');
    const members = data(await orga.db.from('members').select('user_id').eq('vadrouille_id', id), 'membres');
    check(members?.length === 5, '5 membres dans la Vadrouille');
    ok("Aperçu d'invitation sans compte, puis 4 invités ont rejoint par le code");

    // un membre ne peut pas lancer le calcul tant que tout le monde n'a pas répondu
    const early = await guests[0].db.functions.invoke('compute-results', { body: { vadrouilleId: id } });
    check(early.error, 'un invité ne peut pas forcer le calcul avant la fin des réponses');

    for (const [i, a] of actors.entries()) {
      data(
        await a.db.from('responses').upsert({ vadrouille_id: id, user_id: a.userId, answers: personas[i].answers(weekends) }),
        `réponses de ${a.firstName}`,
      );
    }
    ok('Les 5 ont répondu au questionnaire');

    // CONFIDENTIALITÉ : personne, organisateur compris, ne lit les réponses d'un autre
    for (const a of actors) {
      const rows = data(await a.db.from('responses').select('user_id').eq('vadrouille_id', id), 'lecture réponses');
      check(rows?.length === 1 && rows[0].user_id === a.userId, `${a.firstName} ne lit que ses propres réponses`);
    }
    const responded = data(await guests[0].db.from('members').select('responded_at').eq('vadrouille_id', id), 'suivi');
    check(responded?.every((m) => m.responded_at), 'le suivi montre que tout le monde a répondu');
    ok("Confidentialité : chacun ne lit que ses réponses (orga compris) ; le suivi dit qui a répondu");

    const computed = await guests[1].db.functions.invoke('compute-results', { body: { vadrouilleId: id } });
    if (computed.error) {
      const body = await (computed.error as { context?: Response }).context?.text?.().catch(() => '');
      throw new Error(`ÉCHEC : Edge Function compute-results — ${computed.error.message} ${body ?? ''}`);
    }
    check(computed.data?.status === 'ok', `le moteur trouve des options (statut ${computed.data?.status})`);
    const options = data(
      await orga.db.from('result_options').select('*').eq('vadrouille_id', id).order('position'),
      'options',
    ) as { id: string; kind: string; destination_id: string; match_score: number; public_data: { pitchByLlm?: boolean } }[];
    check(options.length === 3, '3 options enregistrées');
    check(new Set(options.map((o) => o.destination_id)).size === 3, '3 destinations distinctes');
    ok(
      `Edge Function : 3 options — ${options.map((o) => `${o.kind} ${o.destination_id} ${o.match_score} %`).join(' · ')}` +
        (options.some((o) => o.public_data.pitchByLlm) ? ' (accroches Claude)' : ' (accroches du seed)'),
    );

    for (const a of actors) {
      const details = data(
        await a.db.from('result_member_details').select('user_id').eq('vadrouille_id', id),
        'budget individuel',
      );
      check(details?.length === 3 && details.every((d) => d.user_id === a.userId), `${a.firstName} ne voit que son budget`);
    }
    ok('Budget individuel : chacun ne voit que le sien, pour les 3 options');

    for (const [i, a] of actors.entries()) {
      data(await a.db.rpc('cast_vote', { p_option_id: options[i < 3 ? 0 : 1].id }), `vote de ${a.firstName}`);
    }
    data(await guests[0].db.rpc('cast_vote', { p_option_id: options[1].id }), 'changement de vote');
    const tally = data(await guests[2].db.rpc('vote_tally', { p_vadrouille_id: id }), 'décompte') as {
      option_id: string;
      votes: number;
    }[];
    check(tally.reduce((n, t) => n + t.votes, 0) === 5, '5 votes comptés');
    const votes = data(await orga.db.from('votes').select('user_id').eq('vadrouille_id', id), 'votes');
    check(votes?.length === 1, "l'orga ne lit que son propre vote");
    const refused = await guests[0].db.rpc('close_vote', { p_vadrouille_id: id });
    check(refused.error, 'un invité ne peut pas clore le vote');
    data(await orga.db.rpc('close_vote', { p_vadrouille_id: id }), 'clôture');
    const final = data(
      await guests[3].db.from('vadrouilles').select('status, decided_option_id').eq('id', id).single(),
      'état final',
    );
    check(final.status === 'decided' && final.decided_option_id === options[1].id, 'la destination gagnante est décidée');
    ok(`Vote (avec changement d'avis), clôture par l'orga : ${options[1].destination_id} gagne 3 voix à 2`);
  } finally {
    const del = await orga.db.from('vadrouilles').delete().eq('id', id);
    console.log(del.error ? `⚠️ Nettoyage impossible : ${del.error.message}` : '🧹 Vadrouille de test supprimée');
  }
  console.log('\nBackend réel : parcours complet validé.');
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});

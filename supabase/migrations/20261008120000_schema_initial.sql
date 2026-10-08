-- =============================================================================
-- Vadrouille — schéma initial
-- =============================================================================
-- Confidentialité (voir CLAUDE.md § Confidentialité) :
--   • responses              : lisible UNIQUEMENT par son auteur (même pas par l'organisateur).
--   • result_member_details  : budget / trajet individuels, lisibles UNIQUEMENT par le membre concerné.
--   • results, result_options: agrégats déjà filtrés par le moteur (seuils anti-réidentification).
--   • votes                  : chacun ne lit que son vote ; le décompte passe par vote_tally().
--   • Écritures sensibles    : uniquement via des fonctions SECURITY DEFINER qui vérifient les droits.
--   • Le calcul lit les réponses avec la clé service_role, dans l'Edge Function compute-results,
--     via get_compute_input() / save_results() (interdites aux clients).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitaires
-- -----------------------------------------------------------------------------

-- Code d'invitation : 10 caractères sans ambiguïté (pas de 0/o, 1/l/i), ~8·10^14 combinaisons.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  raw bytea := uuid_send(gen_random_uuid());
  -- octets entièrement aléatoires d'un UUID v4 (6 et 8 portent version/variante)
  idx constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11];
  code text := '';
  i int;
begin
  foreach i in array idx loop
    code := code || substr(alphabet, (get_byte(raw, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vadrouilles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  -- vendredis de départ des week-ends candidats (2 à 4)
  weekends date[] not null check (cardinality(weekends) between 2 and 4),
  nights smallint not null default 2 check (nights between 1 and 3),
  expected_size smallint not null check (expected_size between 2 and 20),
  invite_code text not null unique default public.generate_invite_code(),
  status text not null default 'collecting' check (status in ('collecting', 'voting', 'decided')),
  results_computed_at timestamptz,
  decided_option_id uuid,
  created_at timestamptz not null default now()
);
create index vadrouilles_organizer_idx on public.vadrouilles (organizer_id);

create table public.members (
  vadrouille_id uuid not null references public.vadrouilles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('organizer', 'member')),
  first_name text not null,
  joined_at timestamptz not null default now(),
  -- seul signal public du questionnaire : QUI a répondu, jamais QUOI
  responded_at timestamptz,
  primary key (vadrouille_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.responses (
  vadrouille_id uuid not null,
  user_id uuid not null default auth.uid(),
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (vadrouille_id, user_id),
  foreign key (vadrouille_id, user_id)
    references public.members (vadrouille_id, user_id) on delete cascade
);

create table public.results (
  vadrouille_id uuid primary key references public.vadrouilles (id) on delete cascade,
  status text not null check (status in ('ok', 'no_feasible', 'no_weekend', 'not_enough_answers')),
  engine_version text not null,
  respondents int not null check (respondents >= 0),
  weekend_start date,
  -- agrégats publics déjà filtrés + diagnostic (critère bloquant, sans dire qui)
  summary jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create table public.result_options (
  id uuid primary key default gen_random_uuid(),
  vadrouille_id uuid not null references public.vadrouilles (id) on delete cascade,
  kind text not null check (kind in ('best', 'budget', 'wild')),
  position smallint not null check (position between 1 and 3),
  destination_id text not null,
  weekend_start date not null,
  comfort text not null check (comfort in ('roots', 'confortable', 'premium')),
  match_score smallint not null check (match_score between 0 and 100),
  -- explication, agrégats filtrés, suggestions : rien d'individuel
  public_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (vadrouille_id, kind)
);
create index result_options_vadrouille_idx on public.result_options (vadrouille_id);

alter table public.vadrouilles
  add constraint vadrouilles_decided_option_fk
  foreign key (decided_option_id) references public.result_options (id) on delete set null;

create table public.result_member_details (
  option_id uuid not null references public.result_options (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vadrouille_id uuid not null references public.vadrouilles (id) on delete cascade,
  -- budget prévisionnel individuel, mode de transport, temps de trajet : PRIVÉ
  details jsonb not null,
  primary key (option_id, user_id)
);
create index result_member_details_user_idx on public.result_member_details (user_id, vadrouille_id);

create table public.votes (
  vadrouille_id uuid not null,
  user_id uuid not null,
  option_id uuid not null references public.result_options (id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (vadrouille_id, user_id),
  foreign key (vadrouille_id, user_id)
    references public.members (vadrouille_id, user_id) on delete cascade
);
create index votes_option_idx on public.votes (option_id);

-- -----------------------------------------------------------------------------
-- Fonctions d'appartenance (utilisées par les politiques RLS)
-- SECURITY DEFINER pour éviter la récursion RLS sur members.
-- -----------------------------------------------------------------------------

create or replace function public.is_member(p_vadrouille_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.vadrouille_id = p_vadrouille_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.can_answer(p_vadrouille_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.vadrouilles v on v.id = m.vadrouille_id
    where m.vadrouille_id = p_vadrouille_id
      and m.user_id = (select auth.uid())
      and v.status = 'collecting'
  );
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger responses_touch_updated_at
  before update on public.responses
  for each row execute function public.touch_updated_at();

-- Validation structurelle des réponses (le moteur revalide finement avant calcul).
create or replace function public.validate_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a jsonb := new.answers;
begin
  if jsonb_typeof(a) is distinct from 'object' then
    raise exception 'invalid_answers: objet attendu' using errcode = '22023';
  end if;
  if pg_column_size(a) > 16384 then
    raise exception 'invalid_answers: trop volumineux' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'budgetMax') is distinct from 'number'
     or (a ->> 'budgetMax')::numeric not between 0 and 10000 then
    raise exception 'invalid_answers: budgetMax' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'departureCity') is distinct from 'string'
     or char_length(a ->> 'departureCity') > 40 then
    raise exception 'invalid_answers: departureCity' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'availability') is distinct from 'object' then
    raise exception 'invalid_answers: availability' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'maxTravelHours') is distinct from 'number'
     or (a ->> 'maxTravelHours')::numeric not between 0 and 24 then
    raise exception 'invalid_answers: maxTravelHours' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'transports') is distinct from 'array'
     or jsonb_typeof(a -> 'cadres') is distinct from 'array'
     or jsonb_typeof(a -> 'envies') is distinct from 'array'
     or jsonb_array_length(a -> 'transports') > 10
     or jsonb_array_length(a -> 'cadres') > 10
     or jsonb_array_length(a -> 'envies') > 10 then
    raise exception 'invalid_answers: listes' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'comfort') is distinct from 'number'
     or (a ->> 'comfort')::numeric not between 0 and 2 then
    raise exception 'invalid_answers: comfort' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'weather') is distinct from 'number'
     or (a ->> 'weather')::numeric not between 0 and 3 then
    raise exception 'invalid_answers: weather' using errcode = '22023';
  end if;
  if jsonb_typeof(a -> 'ambiance') is distinct from 'number'
     or (a ->> 'ambiance')::numeric not between 0 and 1 then
    raise exception 'invalid_answers: ambiance' using errcode = '22023';
  end if;
  if a ? 'importance' and jsonb_typeof(a -> 'importance') is distinct from 'object' then
    raise exception 'invalid_answers: importance' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger responses_validate
  before insert or update on public.responses
  for each row execute function public.validate_response();

-- Le suivi public (« qui a répondu ») est maintenu par trigger : les clients ne peuvent
-- jamais écrire dans members directement.
create or replace function public.sync_member_responded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.members
       set responded_at = null
     where vadrouille_id = old.vadrouille_id and user_id = old.user_id;
    return old;
  end if;
  update public.members
     set responded_at = now()
   where vadrouille_id = new.vadrouille_id and user_id = new.user_id;
  return new;
end;
$$;

create trigger responses_sync_member
  after insert or update or delete on public.responses
  for each row execute function public.sync_member_responded();

create or replace function public.sync_member_names()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.members set first_name = new.first_name where user_id = new.id;
  return new;
end;
$$;

create trigger profiles_sync_member_names
  after update of first_name on public.profiles
  for each row execute function public.sync_member_names();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.vadrouilles enable row level security;
alter table public.members enable row level security;
alter table public.responses enable row level security;
alter table public.results enable row level security;
alter table public.result_options enable row level security;
alter table public.result_member_details enable row level security;
alter table public.votes enable row level security;

-- profiles : chacun ne voit / n'écrit que son propre profil
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- vadrouilles : lecture par les membres ; création via create_vadrouille() ; suppression par l'orga
create policy "vadrouilles_select_members" on public.vadrouilles
  for select to authenticated using (public.is_member(id));
create policy "vadrouilles_delete_organizer" on public.vadrouilles
  for delete to authenticated using (organizer_id = (select auth.uid()));

-- members : les co-membres voient prénoms + statut de réponse ; aucune écriture directe
create policy "members_select_comembers" on public.members
  for select to authenticated using (public.is_member(vadrouille_id));

-- responses : STRICTEMENT privé — uniquement l'auteur, et seulement pendant la collecte
create policy "responses_select_own" on public.responses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "responses_insert_own" on public.responses
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_answer(vadrouille_id));
create policy "responses_update_own" on public.responses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_answer(vadrouille_id));
create policy "responses_delete_own" on public.responses
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.can_answer(vadrouille_id));

-- résultats publics (agrégats filtrés) : membres uniquement
create policy "results_select_members" on public.results
  for select to authenticated using (public.is_member(vadrouille_id));
create policy "result_options_select_members" on public.result_options
  for select to authenticated using (public.is_member(vadrouille_id));

-- détails individuels : uniquement le membre concerné
create policy "result_member_details_select_own" on public.result_member_details
  for select to authenticated using (user_id = (select auth.uid()));

-- votes : chacun ne lit que son propre vote (écriture via cast_vote())
create policy "votes_select_own" on public.votes
  for select to authenticated using (user_id = (select auth.uid()));

-- Privilèges : on part de zéro (Supabase accorde tout par défaut) puis on ouvre au minimum.
revoke all on table
  public.profiles, public.vadrouilles, public.members, public.responses, public.results,
  public.result_options, public.result_member_details, public.votes
  from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, delete on table public.vadrouilles to authenticated;
grant select on table public.members to authenticated;
grant select, insert, update, delete on table public.responses to authenticated;
grant select on table
  public.results, public.result_options, public.result_member_details, public.votes
  to authenticated;

grant all on table
  public.profiles, public.vadrouilles, public.members, public.responses, public.results,
  public.result_options, public.result_member_details, public.votes
  to service_role;

-- -----------------------------------------------------------------------------
-- RPC côté client
-- -----------------------------------------------------------------------------

-- Crée une Vadrouille et inscrit l'appelant comme organisateur (atomique).
create or replace function public.create_vadrouille(
  p_name text,
  p_weekends date[],
  p_expected_size int,
  p_nights int default 2
)
returns public.vadrouilles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_first_name text;
  v_weekends date[];
  v_row public.vadrouilles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select first_name into v_first_name from public.profiles where id = v_uid;
  if v_first_name is null then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  select array_agg(distinct d order by d) into v_weekends from unnest(p_weekends) as d;
  if v_weekends is null or cardinality(v_weekends) not between 2 and 4 then
    raise exception 'invalid_weekends' using errcode = '22023';
  end if;
  if v_weekends[1] < current_date - 2 then
    raise exception 'weekend_in_past' using errcode = '22023';
  end if;

  insert into public.vadrouilles (name, organizer_id, weekends, nights, expected_size)
  values (btrim(p_name), v_uid, v_weekends, p_nights, p_expected_size)
  returning * into v_row;

  insert into public.members (vadrouille_id, user_id, role, first_name)
  values (v_row.id, v_uid, 'organizer', v_first_name);

  return v_row;
end;
$$;

-- Aperçu public d'une invitation (avant connexion) : rien de privé.
create or replace function public.get_invite(p_code text)
returns table (
  vadrouille_id uuid,
  name text,
  organizer_first_name text,
  weekends date[],
  nights int,
  member_count int,
  status text,
  is_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.name,
    o.first_name,
    v.weekends,
    v.nights::int,
    (select count(*)::int from public.members m where m.vadrouille_id = v.id),
    v.status,
    exists (
      select 1 from public.members m
      where m.vadrouille_id = v.id and m.user_id = (select auth.uid())
    )
  from public.vadrouilles v
  join public.members o on o.vadrouille_id = v.id and o.role = 'organizer'
  where v.invite_code = lower(btrim(p_code));
$$;

-- Rejoindre via le code d'invitation (idempotent).
create or replace function public.join_vadrouille(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_first_name text;
  v_id uuid;
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select first_name into v_first_name from public.profiles where id = v_uid;
  if v_first_name is null then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  select id into v_id from public.vadrouilles where invite_code = lower(btrim(p_code));
  if v_id is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.members where vadrouille_id = v_id and user_id = v_uid) then
    return v_id;
  end if;
  select count(*) into v_count from public.members where vadrouille_id = v_id;
  if v_count >= 20 then
    raise exception 'vadrouille_full' using errcode = 'P0001';
  end if;
  insert into public.members (vadrouille_id, user_id, role, first_name)
  values (v_id, v_uid, 'member', v_first_name);
  return v_id;
end;
$$;

-- Désigne l'option gagnante : plus de votes, puis meilleur Match Score, puis ordre d'affichage.
create or replace function public.finalize_vote(p_vadrouille_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_winner uuid;
begin
  select o.id into v_winner
  from public.result_options o
  left join public.votes vt on vt.option_id = o.id
  where o.vadrouille_id = p_vadrouille_id
  group by o.id, o.match_score, o.position
  order by count(vt.user_id) desc, o.match_score desc, o.position asc
  limit 1;
  if v_winner is null then
    raise exception 'no_options' using errcode = 'P0001';
  end if;
  update public.vadrouilles
     set status = 'decided', decided_option_id = v_winner
   where id = p_vadrouille_id;
  return v_winner;
end;
$$;

-- Vote (ou changement de vote). Clôture automatique quand tous les membres ont voté.
create or replace function public.cast_vote(p_option_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vid uuid;
  v_status text;
  v_members int;
  v_votes int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select o.vadrouille_id, v.status into v_vid, v_status
  from public.result_options o
  join public.vadrouilles v on v.id = o.vadrouille_id
  where o.id = p_option_id
  for update of v;
  if v_vid is null
     or not exists (select 1 from public.members where vadrouille_id = v_vid and user_id = v_uid) then
    raise exception 'option_not_found' using errcode = 'P0002';
  end if;
  if v_status <> 'voting' then
    raise exception 'vote_closed' using errcode = 'P0001';
  end if;

  insert into public.votes (vadrouille_id, user_id, option_id)
  values (v_vid, v_uid, p_option_id)
  on conflict (vadrouille_id, user_id)
  do update set option_id = excluded.option_id, voted_at = now();

  select count(*) into v_members from public.members where vadrouille_id = v_vid;
  select count(*) into v_votes from public.votes where vadrouille_id = v_vid;
  if v_votes >= v_members then
    perform public.finalize_vote(v_vid);
  end if;
end;
$$;

-- Décompte des votes par option (jamais qui a voté quoi).
create or replace function public.vote_tally(p_vadrouille_id uuid)
returns table (option_id uuid, votes int)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, count(vt.user_id)::int
  from public.result_options o
  left join public.votes vt on vt.option_id = o.id
  where o.vadrouille_id = p_vadrouille_id
    and public.is_member(p_vadrouille_id)
  group by o.id, o.position
  order by o.position;
$$;

-- Clôture anticipée du vote par l'organisateur.
create or replace function public.close_vote(p_vadrouille_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_org uuid;
begin
  select status, organizer_id into v_status, v_org
  from public.vadrouilles where id = p_vadrouille_id
  for update;
  if v_org is null or v_org <> auth.uid() then
    raise exception 'organizer_only' using errcode = '42501';
  end if;
  if v_status <> 'voting' then
    raise exception 'vote_not_open' using errcode = 'P0001';
  end if;
  return public.finalize_vote(p_vadrouille_id);
end;
$$;

-- Rouvre la collecte (pour modifier des réponses / assouplir un critère) : efface résultats et votes.
create or replace function public.reopen_vadrouille(p_vadrouille_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organizer_id into v_org
  from public.vadrouilles where id = p_vadrouille_id
  for update;
  if v_org is null or v_org <> auth.uid() then
    raise exception 'organizer_only' using errcode = '42501';
  end if;
  delete from public.votes where vadrouille_id = p_vadrouille_id;
  update public.vadrouilles
     set status = 'collecting', decided_option_id = null, results_computed_at = null
   where id = p_vadrouille_id;
  delete from public.result_options where vadrouille_id = p_vadrouille_id;
  delete from public.results where vadrouille_id = p_vadrouille_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC réservées au serveur (Edge Function, clé service_role)
-- -----------------------------------------------------------------------------

-- Entrée du moteur : la Vadrouille, ses membres et TOUTES les réponses brutes.
create or replace function public.get_compute_input(p_vadrouille_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'vadrouille', jsonb_build_object(
      'id', v.id,
      'name', v.name,
      'organizerId', v.organizer_id,
      'weekends', to_jsonb(v.weekends),
      'nights', v.nights,
      'expectedSize', v.expected_size,
      'status', v.status
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id,
        'firstName', m.first_name,
        'role', m.role,
        'respondedAt', m.responded_at
      ) order by m.joined_at)
      from public.members m where m.vadrouille_id = v.id
    ), '[]'::jsonb),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object('userId', r.user_id, 'answers', r.answers)
                       order by r.submitted_at)
      from public.responses r where r.vadrouille_id = v.id
    ), '[]'::jsonb)
  )
  from public.vadrouilles v
  where v.id = p_vadrouille_id;
$$;

-- Enregistre atomiquement le résultat du moteur (remplace le précédent, remet les votes à zéro).
create or replace function public.save_results(p_vadrouille_id uuid, p_result jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := p_result ->> 'status';
  v_current text;
  v_opt jsonb;
  v_detail jsonb;
  v_option_id uuid;
begin
  select status into v_current from public.vadrouilles where id = p_vadrouille_id for update;
  if v_current is null then
    raise exception 'vadrouille_not_found' using errcode = 'P0002';
  end if;
  if v_current = 'decided' then
    raise exception 'already_decided' using errcode = 'P0001';
  end if;

  delete from public.votes where vadrouille_id = p_vadrouille_id;
  update public.vadrouilles set decided_option_id = null where id = p_vadrouille_id;
  delete from public.result_options where vadrouille_id = p_vadrouille_id;

  insert into public.results (
    vadrouille_id, status, engine_version, respondents, weekend_start, summary, computed_at
  )
  values (
    p_vadrouille_id,
    v_status,
    p_result ->> 'engineVersion',
    coalesce((p_result ->> 'respondents')::int, 0),
    nullif(p_result ->> 'weekendStart', '')::date,
    coalesce(p_result -> 'summary', '{}'::jsonb),
    now()
  )
  on conflict (vadrouille_id) do update
    set status = excluded.status,
        engine_version = excluded.engine_version,
        respondents = excluded.respondents,
        weekend_start = excluded.weekend_start,
        summary = excluded.summary,
        computed_at = excluded.computed_at;

  for v_opt in select value from jsonb_array_elements(coalesce(p_result -> 'options', '[]'::jsonb)) loop
    insert into public.result_options (
      vadrouille_id, kind, position, destination_id, weekend_start, comfort, match_score, public_data
    )
    values (
      p_vadrouille_id,
      v_opt ->> 'kind',
      (v_opt ->> 'position')::smallint,
      v_opt ->> 'destinationId',
      (v_opt ->> 'weekendStart')::date,
      v_opt ->> 'comfort',
      (v_opt ->> 'matchScore')::smallint,
      coalesce(v_opt -> 'publicData', '{}'::jsonb)
    )
    returning id into v_option_id;

    for v_detail in select value from jsonb_array_elements(coalesce(v_opt -> 'memberDetails', '[]'::jsonb)) loop
      insert into public.result_member_details (option_id, user_id, vadrouille_id, details)
      values (v_option_id, (v_detail ->> 'userId')::uuid, p_vadrouille_id, v_detail -> 'details');
    end loop;
  end loop;

  update public.vadrouilles
     set status = case when v_status = 'ok' then 'voting' else 'collecting' end,
         results_computed_at = now()
   where id = p_vadrouille_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution (Supabase accorde EXECUTE à anon/authenticated par défaut)
-- -----------------------------------------------------------------------------

revoke execute on function
  public.generate_invite_code(),
  public.touch_updated_at(),
  public.validate_response(),
  public.sync_member_responded(),
  public.sync_member_names(),
  public.is_member(uuid),
  public.can_answer(uuid),
  public.create_vadrouille(text, date[], int, int),
  public.get_invite(text),
  public.join_vadrouille(text),
  public.finalize_vote(uuid),
  public.cast_vote(uuid),
  public.vote_tally(uuid),
  public.close_vote(uuid),
  public.reopen_vadrouille(uuid),
  public.get_compute_input(uuid),
  public.save_results(uuid, jsonb)
  from public, anon, authenticated;

-- utilisées dans les politiques RLS (ne révèlent que l'appartenance de l'appelant)
grant execute on function public.is_member(uuid), public.can_answer(uuid) to authenticated;

grant execute on function
  public.create_vadrouille(text, date[], int, int),
  public.join_vadrouille(text),
  public.cast_vote(uuid),
  public.vote_tally(uuid),
  public.close_vote(uuid),
  public.reopen_vadrouille(uuid)
  to authenticated;

-- l'aperçu d'invitation est consultable avant connexion
grant execute on function public.get_invite(text) to anon, authenticated;

-- serveur uniquement
grant execute on function
  public.get_compute_input(uuid),
  public.save_results(uuid, jsonb)
  to service_role;

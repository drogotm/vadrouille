-- Le vote reste ouvert jusqu'à ce que l'organisateur le close (close_vote) : chacun peut
-- changer son vote tant qu'il est ouvert. Avant : clôture automatique dès que tous les
-- membres avaient voté, ce qui empêchait le dernier votant (et tous les autres) de changer d'avis.
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
end;
$$;

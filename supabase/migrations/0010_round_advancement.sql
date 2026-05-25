-- Phase 3.2 — multi-round flow helpers.
--
-- Two atomic RPCs the host calls to drive the game forward:
--
-- 1. expire_round_no_winner(round_id)
--    Called when the round timer hits zero and nobody has matched. Atomically
--    flips status active → finished and awards the hider a 50% bonus
--    (point_value / 2, rounded down). Race-guarded by `where status='active'`
--    so a late-arriving claim_round_match still wins cleanly.
--
-- 2. start_next_round(session_id, hider_id, round_number)
--    Called by the host after the previous round finished. Inserts a new
--    'pending' round and points sessions.current_round_id at it in one tx.
--    Only the host (sessions.host_id = auth.uid()) may call.
--
-- Both RPCs are SECURITY DEFINER + revoked from PUBLIC + granted to
-- anon, authenticated. Identity is enforced via auth.uid() inside.

create or replace function public.expire_round_no_winner(p_round_id uuid)
returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round rounds%rowtype;
  v_uid uuid := auth.uid();
  v_session sessions%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  -- Only the host of the relevant session may close out a stale round.
  select s.* into v_session
  from rounds r
  join sessions s on s.id = r.session_id
  where r.id = p_round_id
  limit 1;

  if v_session.id is null then
    raise exception 'round not found' using errcode = 'P0002';
  end if;
  if v_session.host_id <> v_uid then
    raise exception 'only the host may expire a round' using errcode = 'P0003';
  end if;

  update rounds
    set status = 'finished',
        ended_at = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;

  if v_round.id is not null then
    -- Hider consolation: 50% of the round's point_value.
    update players
      set score = score + (v_round.point_value / 2)
      where id = v_round.hider_id;
  end if;

  return v_round;
end;
$$;

revoke execute on function public.expire_round_no_winner(uuid) from public;
grant  execute on function public.expire_round_no_winner(uuid) to anon, authenticated;


create or replace function public.start_next_round(
  p_session_id uuid,
  p_hider_id uuid,
  p_round_number int
) returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round rounds%rowtype;
  v_uid uuid := auth.uid();
  v_host uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  select host_id into v_host from sessions where id = p_session_id;
  if v_host is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  if v_host <> v_uid then
    raise exception 'only the host may start the next round' using errcode = 'P0003';
  end if;

  -- Verify the chosen hider is a member of this session.
  perform 1 from players where id = p_hider_id and session_id = p_session_id;
  if not found then
    raise exception 'hider is not a member of this session' using errcode = 'P0004';
  end if;

  insert into rounds (session_id, round_number, hider_id, status, difficulty, point_value)
  values (p_session_id, p_round_number, p_hider_id, 'pending', 'easy', 50)
  returning * into v_round;

  update sessions
    set current_round_id = v_round.id
    where id = p_session_id;

  return v_round;
end;
$$;

revoke execute on function public.start_next_round(uuid, uuid, int) from public;
grant  execute on function public.start_next_round(uuid, uuid, int) to anon, authenticated;

-- Allow seekers to join an in-progress hunt by code.
--
-- Previously join_session_by_code rejected anything past 'lobby'. With 20-min
-- rounds and larger play areas, it's useful to let hiders set their target
-- while seekers trickle in, and let stragglers join mid-hunt without waiting.
--
-- Late-joiner plays whatever's left of the current round. The scoring formula
-- already deflates late finishes via the speed term (migration 0012), so a
-- seeker who joins with 3 min left can still score — just less.
--
-- Rules:
--   * 'lobby'    → allowed (unchanged)
--   * 'playing'  → allowed (new)
--   * 'finished' → rejected (P0003)
--   * Hider role is locked at lobby creation; late-joiners are always seekers
--     (is_host = false in the upsert below).

create or replace function public.join_session_by_code(
  p_code  text,
  p_name  text,
  p_emoji text
) returns sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session sessions%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;
  if length(coalesce(p_name, '')) not between 1 and 24 then
    raise exception 'name must be 1-24 chars' using errcode = 'P0004';
  end if;

  select * into v_session from sessions where code = p_code;
  if v_session.id is null then
    raise exception 'code not found' using errcode = 'P0002';
  end if;
  if v_session.status not in ('lobby', 'playing') then
    raise exception 'hunt already finished' using errcode = 'P0003';
  end if;

  -- Score reset to 0 is correct for both lobby and late-join cases: a new
  -- arrival starts fresh; the on-conflict path only fires when this player
  -- is switching sessions (rejoining their own session goes through
  -- useSession, not this RPC, so their score isn't touched in practice).
  insert into players (id, session_id, name, emoji, is_host, score)
  values (v_uid, v_session.id, p_name, p_emoji, false, 0)
  on conflict (id) do update
    set session_id   = excluded.session_id,
        name         = excluded.name,
        emoji        = excluded.emoji,
        is_host      = false,
        score        = 0,
        last_seen_at = now();

  return v_session;
end;
$$;

revoke execute on function public.join_session_by_code(text, text, text) from public;
grant  execute on function public.join_session_by_code(text, text, text) to anon, authenticated;

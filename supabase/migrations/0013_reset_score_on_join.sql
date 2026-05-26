-- Phase 3.5 follow-up: fix score leak across sessions.
--
-- join_session_by_code's UPSERT (0004) carried the player's old `score`
-- into the new session because the ON CONFLICT body didn't touch it. In
-- practice this meant a returning player kept their previous game's points.
-- create_session_with_host (0007) already resets score; mirror that here.

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
  if v_session.status <> 'lobby' then
    raise exception 'hunt already in progress' using errcode = 'P0003';
  end if;

  -- Idempotent: re-joining the same session refreshes display info; switching
  -- sessions moves the player. Score is reset to 0 so previous-game points
  -- don't leak into the new session (matches create_session_with_host).
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

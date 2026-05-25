-- Phase 1.4 — enable Realtime on session-scoped tables + a join-by-code RPC.
--
-- Realtime: Supabase's CDC engine only emits events for tables in the
-- `supabase_realtime` publication. Add players/rounds/submissions if not
-- already present.

do $$
declare t text;
begin
  foreach t in array array['players', 'rounds', 'submissions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================
-- JOIN BY CODE (atomic lookup + player insert)
-- =============================================
-- A joining user has no player row yet, so the "read own sessions" RLS
-- policy refuses to let them look the session up by code. We solve this
-- with a SECURITY DEFINER RPC that:
--   * looks up the session by code (no recursion: it's the function owner
--     reading, not the caller)
--   * refuses if the session is past lobby
--   * inserts (or refreshes) the caller's player row
--   * returns the session row
--
-- Errors use distinct sqlstates so the client can surface friendly
-- messages without parsing English.

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
  -- sessions moves the player (anon uid is browser-scoped, so this is what
  -- a user expects if they leave one lobby and join another).
  insert into players (id, session_id, name, emoji, is_host)
  values (v_uid, v_session.id, p_name, p_emoji, false)
  on conflict (id) do update
    set session_id   = excluded.session_id,
        name         = excluded.name,
        emoji        = excluded.emoji,
        is_host      = false,
        last_seen_at = now();

  return v_session;
end;
$$;

revoke execute on function public.join_session_by_code(text, text, text) from public;
grant  execute on function public.join_session_by_code(text, text, text) to anon, authenticated;

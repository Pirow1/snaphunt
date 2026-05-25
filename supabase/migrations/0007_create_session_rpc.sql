-- Phase 2.2 — atomic create_session_with_host RPC, mirrors the pattern of
-- join_session_by_code. Avoids the SELECT/upsert chicken-and-egg where the
-- host's player row needs to exist before RLS allows reading the session
-- they're trying to create.

create or replace function public.create_session_with_host(
  p_session_id uuid,
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

  insert into sessions (id, code, host_id) values (p_session_id, p_code, v_uid)
  returning * into v_session;

  insert into players (id, session_id, name, emoji, is_host, score)
  values (v_uid, v_session.id, p_name, p_emoji, true, 0)
  on conflict (id) do update
    set session_id   = excluded.session_id,
        name         = excluded.name,
        emoji        = excluded.emoji,
        is_host      = true,
        score        = 0,
        last_seen_at = now();

  return v_session;
end;
$$;

revoke execute on function public.create_session_with_host(uuid, text, text, text) from public;
grant  execute on function public.create_session_with_host(uuid, text, text, text) to anon, authenticated;

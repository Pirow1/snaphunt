-- Phase 1.4 — switch to Realtime Broadcast (DB-trigger pattern).
--
-- Why: supabase-js 2.106 + recent Realtime server appears to drop
-- postgres_changes deliveries to private channels even with the
-- realtime.messages RLS policy. Broadcast-from-trigger is the modern
-- Supabase pattern that bypasses CDC and explicitly pushes events into
-- a named topic.

create or replace function public.broadcast_session_change()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_session_id uuid;
  v_topic text;
begin
  v_session_id := coalesce(
    (case when tg_op = 'DELETE' then (old).session_id else (new).session_id end),
    null
  );
  if v_session_id is null then
    return null;
  end if;
  v_topic := 'session:' || v_session_id::text;

  perform realtime.send(
    jsonb_build_object(
      'eventType', tg_op,
      'table', tg_table_name,
      'new', case when tg_op <> 'DELETE' then to_jsonb(new) else null end,
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) else null end
    ),
    tg_table_name,        -- event name (clients listen on this)
    v_topic,              -- topic name
    true                  -- private = true → RLS on realtime.messages applies
  );

  return null;
end;
$$;

drop trigger if exists players_broadcast on public.players;
create trigger players_broadcast
  after insert or update or delete on public.players
  for each row execute function public.broadcast_session_change();

drop trigger if exists rounds_broadcast on public.rounds;
create trigger rounds_broadcast
  after insert or update or delete on public.rounds
  for each row execute function public.broadcast_session_change();

-- Sessions trigger — session_id IS the row's id. Re-broadcast as 'sessions'
-- event on its own topic.
create or replace function public.broadcast_session_self()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_topic text;
begin
  v_topic := 'session:' || coalesce(new.id, old.id)::text;
  perform realtime.send(
    jsonb_build_object(
      'eventType', tg_op,
      'table', 'sessions',
      'new', to_jsonb(new),
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) else null end
    ),
    'sessions',
    v_topic,
    true
  );
  return null;
end;
$$;

drop trigger if exists sessions_broadcast on public.sessions;
create trigger sessions_broadcast
  after insert or update on public.sessions
  for each row execute function public.broadcast_session_self();

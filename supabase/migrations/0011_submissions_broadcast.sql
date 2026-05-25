-- Phase 3.2 — broadcast submissions changes so hiders see live verifying
-- toasts. Mirrors the 0006 pattern for players/rounds; resolves session_id
-- via the parent round so the topic name matches `session:<id>`.

create or replace function public.broadcast_submission_change()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_round_id uuid;
  v_session_id uuid;
  v_topic text;
begin
  v_round_id := coalesce(
    (case when tg_op = 'DELETE' then (old).round_id else (new).round_id end),
    null
  );
  if v_round_id is null then return null; end if;

  select session_id into v_session_id from rounds where id = v_round_id;
  if v_session_id is null then return null; end if;

  v_topic := 'session:' || v_session_id::text;

  perform realtime.send(
    jsonb_build_object(
      'eventType', tg_op,
      'table', 'submissions',
      'new', case when tg_op <> 'DELETE' then to_jsonb(new) else null end,
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) else null end
    ),
    'submissions',
    v_topic,
    true
  );
  return null;
end;
$$;

drop trigger if exists submissions_broadcast on public.submissions;
create trigger submissions_broadcast
  after insert or update or delete on public.submissions
  for each row execute function public.broadcast_submission_change();

-- Rush B initial schema
--
-- Idempotent: safe to re-run via `supabase db reset` or repeated pastes
-- into the Studio SQL editor.
--
-- All RPCs are prefixed rb_ to avoid collisions with the parent SnapHunt schema
-- if both apps share the same Supabase project.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- =============================================
-- SESSIONS
-- =============================================
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,
  status text not null default 'lobby',
  current_round_id uuid,
  settings jsonb not null default '{
    "rounds_total": 3,
    "location_tolerance_meters": 30,
    "local_match_threshold": 0.85,
    "local_reject_threshold": 0.55,
    "final_match_threshold": 75
  }'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_rb_sessions_code on sessions(code);

-- =============================================
-- PLAYERS
-- =============================================
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null check (length(name) between 1 and 24),
  emoji text not null default '💣',
  score int not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_rb_players_session on players(session_id);

-- =============================================
-- ROUNDS
-- =============================================
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_number int not null,
  planter_id uuid not null references players(id),
  photo_path text,
  photo_embedding jsonb,
  bomb_timer_seconds int not null default 300,
  point_value int not null default 50,
  planter_lat double precision,
  planter_lng double precision,
  status text not null default 'pending',
  winner_id uuid references players(id),
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_rb_rounds_session on rounds(session_id);

-- =============================================
-- SUBMISSIONS
-- =============================================
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  defuser_id uuid not null references players(id),
  photo_path text,
  local_similarity numeric,
  cloud_similarity int,
  cloud_reasoning text,
  is_match boolean,
  defuser_lat double precision not null,
  defuser_lng double precision not null,
  distance_meters double precision,
  points_awarded int,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists idx_rb_submissions_round on submissions(round_id);

-- =============================================
-- ROW-LEVEL SECURITY
-- =============================================
alter table sessions    enable row level security;
alter table players     enable row level security;
alter table rounds      enable row level security;
alter table submissions enable row level security;

-- sessions
drop policy if exists "rb read own sessions"    on sessions;
drop policy if exists "rb create session"       on sessions;
drop policy if exists "rb host updates session" on sessions;

create policy "rb read own sessions" on sessions for select
  using (id in (select session_id from players where id = auth.uid()));
create policy "rb create session" on sessions for insert with check (true);
create policy "rb host updates session" on sessions for update using (host_id = auth.uid());

-- players
drop policy if exists "rb read session players" on players;
drop policy if exists "rb join session"         on players;
drop policy if exists "rb update self"          on players;

create policy "rb read session players" on players for select
  using (session_id in (select session_id from players where id = auth.uid()));
create policy "rb join session" on players for insert with check (id = auth.uid());
create policy "rb update self"  on players for update using (id = auth.uid());

-- rounds
drop policy if exists "rb read session rounds"  on rounds;
drop policy if exists "rb planter updates round" on rounds;
drop policy if exists "rb host inserts round"   on rounds;

create policy "rb read session rounds" on rounds for select
  using (session_id in (select session_id from players where id = auth.uid()));
create policy "rb planter updates round" on rounds for update using (planter_id = auth.uid());
create policy "rb host inserts round" on rounds for insert with check (
  session_id in (select session_id from players where id = auth.uid() and is_host = true)
);

-- submissions
drop policy if exists "rb read own submissions" on submissions;
drop policy if exists "rb submit guess"         on submissions;
drop policy if exists "rb update own submission" on submissions;

create policy "rb read own submissions" on submissions for select
  using (
    defuser_id = auth.uid()
    or round_id in (select id from rounds where planter_id = auth.uid())
  );
create policy "rb submit guess" on submissions for insert with check (defuser_id = auth.uid());
create policy "rb update own submission" on submissions for update using (defuser_id = auth.uid());

-- =============================================
-- STORAGE BUCKET
-- =============================================
insert into storage.buckets (id, name, public)
values ('round-photos', 'round-photos', false)
on conflict (id) do nothing;

drop policy if exists "rb auth users read photos"  on storage.objects;
drop policy if exists "rb auth users write photos" on storage.objects;

create policy "rb auth users read photos" on storage.objects for select
  using (bucket_id = 'round-photos' and auth.uid() is not null);
create policy "rb auth users write photos" on storage.objects for insert
  with check (bucket_id = 'round-photos' and auth.uid() is not null);

-- =============================================
-- REALTIME
-- =============================================
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
-- RPC: rb_create_session_with_host
-- =============================================
create or replace function public.rb_create_session_with_host(
  p_session_id uuid,
  p_code       text,
  p_name       text,
  p_emoji      text
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

revoke execute on function public.rb_create_session_with_host(uuid, text, text, text) from public;
grant  execute on function public.rb_create_session_with_host(uuid, text, text, text) to anon, authenticated;

-- =============================================
-- RPC: rb_join_session_by_code
-- =============================================
create or replace function public.rb_join_session_by_code(
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
    raise exception 'operation already ended' using errcode = 'P0003';
  end if;

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

revoke execute on function public.rb_join_session_by_code(text, text, text) from public;
grant  execute on function public.rb_join_session_by_code(text, text, text) to anon, authenticated;

-- =============================================
-- RPC: rb_start_next_round
-- =============================================
create or replace function public.rb_start_next_round(
  p_session_id  uuid,
  p_planter_id  uuid,
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

  perform 1 from players where id = p_planter_id and session_id = p_session_id;
  if not found then
    raise exception 'planter is not a member of this session' using errcode = 'P0004';
  end if;

  insert into rounds (session_id, round_number, planter_id, status, bomb_timer_seconds, point_value)
  values (p_session_id, p_round_number, p_planter_id, 'pending', 300, 50)
  returning * into v_round;

  update sessions
    set current_round_id = v_round.id
    where id = p_session_id;

  return v_round;
end;
$$;

revoke execute on function public.rb_start_next_round(uuid, uuid, int) from public;
grant  execute on function public.rb_start_next_round(uuid, uuid, int) to anon, authenticated;

-- =============================================
-- RPC: rb_expire_round_no_winner
-- Bomb explodes — planter wins, gets full points
-- =============================================
create or replace function public.rb_expire_round_no_winner(p_round_id uuid)
returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round   rounds%rowtype;
  v_uid     uuid := auth.uid();
  v_session sessions%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

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
    set status   = 'finished',
        ended_at = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;

  if v_round.id is not null then
    -- Planter wins when bomb detonates
    update players
      set score = score + v_round.point_value
      where id = v_round.planter_id;
  end if;

  return v_round;
end;
$$;

revoke execute on function public.rb_expire_round_no_winner(uuid) from public;
grant  execute on function public.rb_expire_round_no_winner(uuid) to anon, authenticated;

-- =============================================
-- RPC: rb_claim_round_defused
-- Defuser solved the puzzle — defuser wins
-- =============================================
create or replace function public.rb_claim_round_defused(p_round_id uuid)
returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round          rounds%rowtype;
  v_uid            uuid := auth.uid();
  v_submission_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  -- Verify the caller has a matched, verified submission for this round
  select id into v_submission_id
  from submissions
  where round_id   = p_round_id
    and defuser_id = v_uid
    and is_match   = true
    and status     = 'verified'
  limit 1;

  if v_submission_id is null then
    raise exception 'no matching submission found' using errcode = 'P0005';
  end if;

  -- Atomic claim: race-guarded so only the first solver wins
  update rounds
    set winner_id = v_uid,
        status    = 'finished',
        ended_at  = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;

  if v_round.id is not null then
    update players
      set score = score + v_round.point_value
      where id = v_uid;
  end if;

  return v_round;
end;
$$;

revoke execute on function public.rb_claim_round_defused(uuid) from public;
grant  execute on function public.rb_claim_round_defused(uuid) to anon, authenticated;

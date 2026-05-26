-- SnapHunt initial schema (spec v2 §6, §6.2, §10.3)
--
-- Idempotent: safe to re-run via `supabase db reset` or repeated pastes
-- into the Studio SQL editor.

create extension if not exists pgcrypto;
create extension if not exists vector;  -- enables pgvector (used in stretch goals)

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
    "rounds_total": 5,
    "round_duration_seconds": 1200,
    "location_tolerance_meters": 30,
    "local_match_threshold": 0.85,
    "local_reject_threshold": 0.55,
    "final_match_threshold": 75
  }'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_sessions_code on sessions(code);

-- =============================================
-- PLAYERS
-- =============================================
-- Note: the player's PK equals the auth.uid() of the signed-in anon user.
-- Default UUID gen is left in place for tests / service-role inserts, but
-- the RLS "join session" policy forces id = auth.uid() for normal inserts.
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null check (length(name) between 1 and 24),
  emoji text not null default '🦊',
  score int not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_players_session on players(session_id);

-- =============================================
-- ROUNDS
-- =============================================
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  round_number int not null,
  hider_id uuid not null references players(id),
  photo_path text,
  -- Pillar 1: store CLIP embedding (512-dim float32) for fast seeker comparison
  photo_embedding jsonb,  -- json array of 512 floats; could use pgvector later
  hint text,
  difficulty text not null default 'easy',
  point_value int not null default 50,
  hider_lat double precision,
  hider_lng double precision,
  status text not null default 'pending',
  winner_id uuid references players(id),
  started_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_rounds_session on rounds(session_id);

-- =============================================
-- SUBMISSIONS
-- =============================================
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  seeker_id uuid not null references players(id),
  photo_path text,                       -- nullable if local-rejected, no upload
  -- Pillar 1: local fast-pass score
  local_similarity numeric,              -- 0.0-1.0 cosine similarity from CLIP
  -- Cloud verdict (only populated when escalated)
  cloud_similarity int,                  -- 0-100 from Claude
  cloud_reasoning text,
  -- Final decision
  is_match boolean,
  decision_source text,                  -- 'local_high' | 'local_low' | 'cloud'
  seeker_lat double precision not null,
  seeker_lng double precision not null,
  distance_meters double precision,
  status text not null default 'pending', -- pending | verified | error
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists idx_submissions_round on submissions(round_id);

-- =============================================
-- ROW-LEVEL SECURITY (spec §6.2)
-- =============================================
alter table sessions    enable row level security;
alter table players     enable row level security;
alter table rounds      enable row level security;
alter table submissions enable row level security;

-- sessions
drop policy if exists "read own sessions"   on sessions;
drop policy if exists "create session"      on sessions;
drop policy if exists "host updates session" on sessions;

create policy "read own sessions" on sessions for select
  using (id in (select session_id from players where id = auth.uid()));
create policy "create session" on sessions for insert with check (true);
create policy "host updates session" on sessions for update using (host_id = auth.uid());

-- players
drop policy if exists "read session players" on players;
drop policy if exists "join session"          on players;
drop policy if exists "update self"           on players;

create policy "read session players" on players for select
  using (session_id in (select session_id from players where id = auth.uid()));
create policy "join session" on players for insert with check (id = auth.uid());
create policy "update self"  on players for update using (id = auth.uid());

-- rounds
drop policy if exists "read session rounds" on rounds;
drop policy if exists "hider updates round" on rounds;
drop policy if exists "host inserts round"  on rounds;

create policy "read session rounds" on rounds for select
  using (session_id in (select session_id from players where id = auth.uid()));
create policy "hider updates round" on rounds for update using (hider_id = auth.uid());
-- host (or any player in the session) can insert a new round
create policy "host inserts round" on rounds for insert with check (
  session_id in (select session_id from players where id = auth.uid() and is_host = true)
);

-- submissions
drop policy if exists "read own submissions" on submissions;
drop policy if exists "submit guess"          on submissions;

create policy "read own submissions" on submissions for select
  using (
    seeker_id = auth.uid()
    or round_id in (select id from rounds where hider_id = auth.uid())
  );
create policy "submit guess" on submissions for insert with check (seeker_id = auth.uid());
-- Edge function uses service role and bypasses RLS for verification updates.

-- =============================================
-- STORAGE BUCKETS (spec §6.1)
-- =============================================
insert into storage.buckets (id, name, public)
values
  ('round-photos',      'round-photos',      false),
  ('submission-photos', 'submission-photos', false)
on conflict (id) do nothing;

-- Storage RLS: allow authenticated users (incl. anon) to read/write photos
-- in either bucket. Bucket isolation + the photo_path scoping in the app
-- prevents cross-session leakage; signed URLs are issued by the edge function
-- for cross-player viewing in the gallery.
drop policy if exists "auth users read photos"  on storage.objects;
drop policy if exists "auth users write photos" on storage.objects;

create policy "auth users read photos" on storage.objects for select
  using (bucket_id in ('round-photos', 'submission-photos') and auth.uid() is not null);
create policy "auth users write photos" on storage.objects for insert
  with check (bucket_id in ('round-photos', 'submission-photos') and auth.uid() is not null);

-- =============================================
-- ATOMIC ROUND WINNER FINALIZATION (spec §10.3)
-- =============================================
-- Used by the edge function once a cloud verdict matches. The
-- `where status='active'` guard means only the first match wins.
create or replace function finalize_round_winner(p_round_id uuid, p_seeker_id uuid)
returns rounds as $$
declare
  v_round rounds%rowtype;
begin
  update rounds
    set winner_id = p_seeker_id,
        status = 'finished',
        ended_at = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;

  if v_round.id is not null then
    update players
      set score = score + v_round.point_value
      where id = p_seeker_id;
  end if;
  return v_round;
end;
$$ language plpgsql security definer;

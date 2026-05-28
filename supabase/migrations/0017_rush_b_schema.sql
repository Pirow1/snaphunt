-- Rush B schema — copied from rush-b branch with IF NOT EXISTS guards
-- so this migration is idempotent when run alongside the SnapHunt migrations.
-- All RPCs are prefixed rb_ to avoid collisions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================
-- rb_sessions (namespaced table for Rush B)
-- =============================================
CREATE TABLE IF NOT EXISTS public.rb_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  host_id          UUID NOT NULL,
  status           TEXT NOT NULL DEFAULT 'lobby',
  current_round_id UUID,
  settings         JSONB NOT NULL DEFAULT '{
    "rounds_total": 3,
    "location_tolerance_meters": 30,
    "local_match_threshold": 0.85,
    "local_reject_threshold": 0.55,
    "final_match_threshold": 75
  }'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rb_sessions_code ON public.rb_sessions(code);

-- =============================================
-- rb_players
-- =============================================
CREATE TABLE IF NOT EXISTS public.rb_players (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.rb_sessions(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 24),
  emoji        TEXT NOT NULL DEFAULT '💣',
  score        INT  NOT NULL DEFAULT 0,
  is_host      BOOLEAN NOT NULL DEFAULT false,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rb_players_session ON public.rb_players(session_id);

-- =============================================
-- rb_rounds
-- =============================================
CREATE TABLE IF NOT EXISTS public.rb_rounds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES public.rb_sessions(id) ON DELETE CASCADE,
  round_number       INT  NOT NULL,
  planter_id         UUID NOT NULL REFERENCES public.rb_players(id),
  photo_path         TEXT,
  photo_embedding    JSONB,
  bomb_timer_seconds INT  NOT NULL DEFAULT 300,
  point_value        INT  NOT NULL DEFAULT 50,
  planter_lat        DOUBLE PRECISION,
  planter_lng        DOUBLE PRECISION,
  status             TEXT NOT NULL DEFAULT 'pending',
  winner_id          UUID REFERENCES public.rb_players(id),
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rb_rounds_session ON public.rb_rounds(session_id);

-- =============================================
-- rb_submissions
-- =============================================
CREATE TABLE IF NOT EXISTS public.rb_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id         UUID NOT NULL REFERENCES public.rb_rounds(id) ON DELETE CASCADE,
  defuser_id       UUID NOT NULL REFERENCES public.rb_players(id),
  photo_path       TEXT,
  local_similarity NUMERIC,
  cloud_similarity INT,
  cloud_reasoning  TEXT,
  is_match         BOOLEAN,
  defuser_lat      DOUBLE PRECISION NOT NULL,
  defuser_lng      DOUBLE PRECISION NOT NULL,
  distance_meters  DOUBLE PRECISION,
  points_awarded   INT,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rb_submissions_round ON public.rb_submissions(round_id);

-- =============================================
-- ROW-LEVEL SECURITY
-- =============================================
ALTER TABLE public.rb_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rb_players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rb_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rb_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_sessions' AND policyname='rb read own sessions') THEN
    CREATE POLICY "rb read own sessions" ON public.rb_sessions FOR SELECT
      USING (id IN (SELECT session_id FROM public.rb_players WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_sessions' AND policyname='rb create session') THEN
    CREATE POLICY "rb create session" ON public.rb_sessions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_sessions' AND policyname='rb host updates session') THEN
    CREATE POLICY "rb host updates session" ON public.rb_sessions FOR UPDATE USING (host_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_players' AND policyname='rb read session players') THEN
    CREATE POLICY "rb read session players" ON public.rb_players FOR SELECT
      USING (session_id IN (SELECT session_id FROM public.rb_players WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_players' AND policyname='rb join session') THEN
    CREATE POLICY "rb join session" ON public.rb_players FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_players' AND policyname='rb update self') THEN
    CREATE POLICY "rb update self" ON public.rb_players FOR UPDATE USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_rounds' AND policyname='rb read session rounds') THEN
    CREATE POLICY "rb read session rounds" ON public.rb_rounds FOR SELECT
      USING (session_id IN (SELECT session_id FROM public.rb_players WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_rounds' AND policyname='rb planter updates round') THEN
    CREATE POLICY "rb planter updates round" ON public.rb_rounds FOR UPDATE USING (planter_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_rounds' AND policyname='rb host inserts round') THEN
    CREATE POLICY "rb host inserts round" ON public.rb_rounds FOR INSERT WITH CHECK (
      session_id IN (SELECT session_id FROM public.rb_players WHERE id = auth.uid() AND is_host = true)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_submissions' AND policyname='rb read own submissions') THEN
    CREATE POLICY "rb read own submissions" ON public.rb_submissions FOR SELECT
      USING (
        defuser_id = auth.uid()
        OR round_id IN (SELECT id FROM public.rb_rounds WHERE planter_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_submissions' AND policyname='rb submit guess') THEN
    CREATE POLICY "rb submit guess" ON public.rb_submissions FOR INSERT WITH CHECK (defuser_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rb_submissions' AND policyname='rb update own submission') THEN
    CREATE POLICY "rb update own submission" ON public.rb_submissions FOR UPDATE USING (defuser_id = auth.uid());
  END IF;
END $$;

-- =============================================
-- STORAGE BUCKET
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('round-photos', 'round-photos', false)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='rb auth users read photos') THEN
    CREATE POLICY "rb auth users read photos" ON storage.objects FOR SELECT
      USING (bucket_id = 'round-photos' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='rb auth users write photos') THEN
    CREATE POLICY "rb auth users write photos" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'round-photos' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- =============================================
-- REALTIME
-- =============================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['rb_players', 'rb_rounds', 'rb_submissions'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- =============================================
-- RPC: rb_create_session_with_host
-- =============================================
CREATE OR REPLACE FUNCTION public.rb_create_session_with_host(
  p_session_id uuid,
  p_code       text,
  p_name       text,
  p_emoji      text
) RETURNS public.rb_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session rb_sessions%rowtype;
  v_uid     UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_name, '')) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'name must be 1-24 chars' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO rb_sessions (id, code, host_id) VALUES (p_session_id, p_code, v_uid)
  RETURNING * INTO v_session;

  INSERT INTO rb_players (id, session_id, name, emoji, is_host, score)
  VALUES (v_uid, v_session.id, p_name, p_emoji, true, 0)
  ON CONFLICT (id) DO UPDATE
    SET session_id   = excluded.session_id,
        name         = excluded.name,
        emoji        = excluded.emoji,
        is_host      = true,
        score        = 0,
        last_seen_at = now();

  RETURN v_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_create_session_with_host(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_create_session_with_host(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- =============================================
-- RPC: rb_join_session_by_code
-- =============================================
CREATE OR REPLACE FUNCTION public.rb_join_session_by_code(
  p_code  text,
  p_name  text,
  p_emoji text
) RETURNS public.rb_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session rb_sessions%rowtype;
  v_uid     UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_name, '')) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'name must be 1-24 chars' USING ERRCODE = 'P0004';
  END IF;

  SELECT * INTO v_session FROM rb_sessions WHERE code = p_code;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'code not found' USING ERRCODE = 'P0002'; END IF;
  IF v_session.status NOT IN ('lobby', 'playing') THEN
    RAISE EXCEPTION 'operation already ended' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO rb_players (id, session_id, name, emoji, is_host, score)
  VALUES (v_uid, v_session.id, p_name, p_emoji, false, 0)
  ON CONFLICT (id) DO UPDATE
    SET session_id   = excluded.session_id,
        name         = excluded.name,
        emoji        = excluded.emoji,
        is_host      = false,
        score        = 0,
        last_seen_at = now();

  RETURN v_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_join_session_by_code(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_join_session_by_code(TEXT, TEXT, TEXT) TO anon, authenticated;

-- =============================================
-- RPC: rb_start_next_round
-- =============================================
CREATE OR REPLACE FUNCTION public.rb_start_next_round(
  p_session_id   uuid,
  p_planter_id   uuid,
  p_round_number int
) RETURNS public.rb_rounds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_round rb_rounds%rowtype;
  v_uid   UUID := auth.uid();
  v_host  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;

  SELECT host_id INTO v_host FROM rb_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN RAISE EXCEPTION 'session not found' USING ERRCODE = 'P0002'; END IF;
  IF v_host <> v_uid THEN RAISE EXCEPTION 'only the host may start the next round' USING ERRCODE = 'P0003'; END IF;

  PERFORM 1 FROM rb_players WHERE id = p_planter_id AND session_id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'planter is not a member of this session' USING ERRCODE = 'P0004'; END IF;

  INSERT INTO rb_rounds (session_id, round_number, planter_id, status, bomb_timer_seconds, point_value)
  VALUES (p_session_id, p_round_number, p_planter_id, 'pending', 300, 50)
  RETURNING * INTO v_round;

  UPDATE rb_sessions SET current_round_id = v_round.id WHERE id = p_session_id;

  RETURN v_round;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_start_next_round(UUID, UUID, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_start_next_round(UUID, UUID, INT) TO anon, authenticated;

-- =============================================
-- RPC: rb_expire_round_no_winner
-- =============================================
CREATE OR REPLACE FUNCTION public.rb_expire_round_no_winner(p_round_id uuid)
RETURNS public.rb_rounds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_round   rb_rounds%rowtype;
  v_uid     UUID := auth.uid();
  v_session rb_sessions%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;

  SELECT s.* INTO v_session
  FROM rb_rounds r
  JOIN rb_sessions s ON s.id = r.session_id
  WHERE r.id = p_round_id LIMIT 1;

  IF v_session.id IS NULL THEN RAISE EXCEPTION 'round not found' USING ERRCODE = 'P0002'; END IF;
  IF v_session.host_id <> v_uid THEN RAISE EXCEPTION 'only the host may expire a round' USING ERRCODE = 'P0003'; END IF;

  UPDATE rb_rounds
    SET status = 'finished', ended_at = now()
    WHERE id = p_round_id AND status = 'active'
    RETURNING * INTO v_round;

  IF v_round.id IS NOT NULL THEN
    UPDATE rb_players SET score = score + v_round.point_value WHERE id = v_round.planter_id;
  END IF;

  RETURN v_round;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_expire_round_no_winner(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_expire_round_no_winner(UUID) TO anon, authenticated;

-- =============================================
-- RPC: rb_claim_round_defused
-- =============================================
CREATE OR REPLACE FUNCTION public.rb_claim_round_defused(p_round_id uuid)
RETURNS public.rb_rounds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_round         rb_rounds%rowtype;
  v_uid           UUID := auth.uid();
  v_submission_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;

  SELECT id INTO v_submission_id
  FROM rb_submissions
  WHERE round_id   = p_round_id
    AND defuser_id = v_uid
    AND is_match   = true
    AND status     = 'verified'
  LIMIT 1;

  IF v_submission_id IS NULL THEN RAISE EXCEPTION 'no matching submission found' USING ERRCODE = 'P0005'; END IF;

  UPDATE rb_rounds
    SET winner_id = v_uid, status = 'finished', ended_at = now()
    WHERE id = p_round_id AND status = 'active'
    RETURNING * INTO v_round;

  IF v_round.id IS NOT NULL THEN
    UPDATE rb_players SET score = score + v_round.point_value WHERE id = v_uid;
  END IF;

  RETURN v_round;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_claim_round_defused(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_claim_round_defused(UUID) TO anon, authenticated;

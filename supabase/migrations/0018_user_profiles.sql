-- user_profiles: shared between SnapHunt and Rush B
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  photo_url  TEXT,
  emoji      TEXT NOT NULL DEFAULT '🎮',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_email_idx
  ON public.user_profiles (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_phone_idx
  ON public.user_profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='Public read user_profiles') THEN
    CREATE POLICY "Public read user_profiles" ON public.user_profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='Public insert user_profiles') THEN
    CREATE POLICY "Public insert user_profiles" ON public.user_profiles FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='Public update user_profiles') THEN
    CREATE POLICY "Public update user_profiles" ON public.user_profiles FOR UPDATE USING (true);
  END IF;
END $$;

ALTER TABLE public.players    ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES public.user_profiles(id);
ALTER TABLE public.rb_players ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES public.user_profiles(id);

-- Storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Public read profile-photos') THEN
    CREATE POLICY "Public read profile-photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Public upload profile-photos') THEN
    CREATE POLICY "Public upload profile-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-photos');
  END IF;
END $$;

-- Lookup function (returns first match by email or phone)
CREATE OR REPLACE FUNCTION public.find_user_by_contact(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
) RETURNS SETOF public.user_profiles
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM user_profiles
  WHERE
    (p_email IS NOT NULL AND p_email <> '' AND lower(email) = lower(p_email))
    OR (p_phone IS NOT NULL AND p_phone <> '' AND phone = p_phone)
  LIMIT 1;
$$;

-- Update SnapHunt RPCs to accept optional user_profile_id
CREATE OR REPLACE FUNCTION public.create_session_with_host(
  p_session_id      UUID,
  p_code            TEXT,
  p_name            TEXT,
  p_emoji           TEXT,
  p_user_profile_id UUID DEFAULT NULL
) RETURNS sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session sessions%rowtype;
  v_uid     UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_name,'')) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'name must be 1-24 chars' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO sessions (id, code, host_id) VALUES (p_session_id, p_code, v_uid)
  RETURNING * INTO v_session;

  INSERT INTO players (id, session_id, name, emoji, is_host, score, user_profile_id)
  VALUES (v_uid, v_session.id, p_name, p_emoji, true, 0, p_user_profile_id)
  ON CONFLICT (id) DO UPDATE
    SET session_id      = excluded.session_id,
        name            = excluded.name,
        emoji           = excluded.emoji,
        is_host         = true,
        score           = 0,
        user_profile_id = excluded.user_profile_id,
        last_seen_at    = now();

  RETURN v_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_session_with_host(UUID,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_session_with_host(UUID,TEXT,TEXT,TEXT,UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_session_by_code(
  p_code            TEXT,
  p_name            TEXT,
  p_emoji           TEXT,
  p_user_profile_id UUID DEFAULT NULL
) RETURNS sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session sessions%rowtype;
  v_uid     UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_name,'')) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'name must be 1-24 chars' USING ERRCODE = 'P0004';
  END IF;

  SELECT * INTO v_session FROM sessions WHERE code = p_code;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'code not found' USING ERRCODE = 'P0002'; END IF;
  IF v_session.status NOT IN ('lobby','playing') THEN
    RAISE EXCEPTION 'hunt already finished' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO players (id, session_id, name, emoji, is_host, score, user_profile_id)
  VALUES (v_uid, v_session.id, p_name, p_emoji, false, 0, p_user_profile_id)
  ON CONFLICT (id) DO UPDATE
    SET session_id      = excluded.session_id,
        name            = excluded.name,
        emoji           = excluded.emoji,
        is_host         = false,
        score           = 0,
        user_profile_id = excluded.user_profile_id,
        last_seen_at    = now();

  RETURN v_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_session_by_code(TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.join_session_by_code(TEXT,TEXT,TEXT,UUID) TO anon, authenticated;

-- Rush B RPCs updated with user_profile_id support
CREATE OR REPLACE FUNCTION public.rb_create_session_with_host(
  p_session_id      UUID,
  p_code            TEXT,
  p_name            TEXT,
  p_emoji           TEXT,
  p_user_profile_id UUID DEFAULT NULL
) RETURNS public.rb_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session rb_sessions%rowtype;
  v_uid     UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_name,'')) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'name must be 1-24 chars' USING ERRCODE = 'P0004';
  END IF;

  INSERT INTO rb_sessions (id, code, host_id) VALUES (p_session_id, p_code, v_uid)
  RETURNING * INTO v_session;

  INSERT INTO rb_players (id, session_id, name, emoji, is_host, score, user_profile_id)
  VALUES (v_uid, v_session.id, p_name, p_emoji, true, 0, p_user_profile_id)
  ON CONFLICT (id) DO UPDATE
    SET session_id      = excluded.session_id,
        name            = excluded.name,
        emoji           = excluded.emoji,
        is_host         = true,
        score           = 0,
        user_profile_id = excluded.user_profile_id,
        last_seen_at    = now();

  RETURN v_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_create_session_with_host(UUID,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_create_session_with_host(UUID,TEXT,TEXT,TEXT,UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rb_join_session_by_code(
  p_code            TEXT,
  p_name            TEXT,
  p_emoji           TEXT,
  p_user_profile_id UUID DEFAULT NULL
) RETURNS public.rb_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session rb_sessions%rowtype;
  v_uid     UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_name,'')) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'name must be 1-24 chars' USING ERRCODE = 'P0004';
  END IF;

  SELECT * INTO v_session FROM rb_sessions WHERE code = p_code;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'code not found' USING ERRCODE = 'P0002'; END IF;
  IF v_session.status NOT IN ('lobby','playing') THEN
    RAISE EXCEPTION 'operation already ended' USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO rb_players (id, session_id, name, emoji, is_host, score, user_profile_id)
  VALUES (v_uid, v_session.id, p_name, p_emoji, false, 0, p_user_profile_id)
  ON CONFLICT (id) DO UPDATE
    SET session_id      = excluded.session_id,
        name            = excluded.name,
        emoji           = excluded.emoji,
        is_host         = false,
        score           = 0,
        user_profile_id = excluded.user_profile_id,
        last_seen_at    = now();

  RETURN v_session;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_join_session_by_code(TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_join_session_by_code(TEXT,TEXT,TEXT,UUID) TO anon, authenticated;

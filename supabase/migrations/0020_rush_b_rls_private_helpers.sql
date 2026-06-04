-- Harden the Rush B RLS helpers added in 0019.
--
-- 0019 created the helpers in `public`, so PostgREST exposed them as RPC
-- (/rest/v1/rpc/rb_user_session_ids) callable by anon/authenticated — flagged
-- by the security advisor (anon_security_definer_function_executable). They
-- only ever return the caller's own session ids, so the exposure is harmless,
-- but RLS helpers have no business being RPC-callable.
--
-- Move them into a `private` schema (not exposed by PostgREST), keep EXECUTE for
-- the roles that evaluate the policies, and repoint the policies. Idempotent.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.rb_user_session_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session_id FROM public.rb_players WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.rb_user_host_session_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session_id FROM public.rb_players WHERE id = auth.uid() AND is_host = true;
$$;

REVOKE EXECUTE ON FUNCTION private.rb_user_session_ids()      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.rb_user_host_session_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION private.rb_user_session_ids()      TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION private.rb_user_host_session_ids() TO anon, authenticated;

-- Repoint policies to the private helpers (must happen before dropping the
-- public ones, which the policies currently depend on).
DROP POLICY IF EXISTS "rb read session players" ON public.rb_players;
CREATE POLICY "rb read session players" ON public.rb_players FOR SELECT
  USING (session_id IN (SELECT private.rb_user_session_ids()));

DROP POLICY IF EXISTS "rb read own sessions" ON public.rb_sessions;
CREATE POLICY "rb read own sessions" ON public.rb_sessions FOR SELECT
  USING (id IN (SELECT private.rb_user_session_ids()));

DROP POLICY IF EXISTS "rb read session rounds" ON public.rb_rounds;
CREATE POLICY "rb read session rounds" ON public.rb_rounds FOR SELECT
  USING (session_id IN (SELECT private.rb_user_session_ids()));

DROP POLICY IF EXISTS "rb host inserts round" ON public.rb_rounds;
CREATE POLICY "rb host inserts round" ON public.rb_rounds FOR INSERT
  WITH CHECK (session_id IN (SELECT private.rb_user_host_session_ids()));

-- Remove the now-unused public (RPC-exposed) helpers.
DROP FUNCTION IF EXISTS public.rb_user_session_ids();
DROP FUNCTION IF EXISTS public.rb_user_host_session_ids();

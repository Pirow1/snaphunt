-- Fix infinite recursion in Rush B RLS policies (introduced in 0017).
--
-- 0017 defined a SELECT policy on rb_players whose USING clause subqueries
-- rb_players itself. Evaluating that policy re-applies the same policy ->
-- 42P17 "infinite recursion detected in policy for relation rb_players".
-- The rb_sessions / rb_rounds read+insert policies also subquery rb_players,
-- so they hit the same recursion.
--
-- Fix: resolve the current user's session membership in SECURITY DEFINER
-- helpers (which run as the function owner and bypass RLS), then rewrite the
-- offending policies to call the helpers instead of subquerying rb_players
-- under RLS. Idempotent: safe to re-run.

-- =============================================
-- HELPERS (bypass RLS via SECURITY DEFINER)
-- =============================================
CREATE OR REPLACE FUNCTION public.rb_user_session_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session_id FROM public.rb_players WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.rb_user_host_session_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT session_id FROM public.rb_players WHERE id = auth.uid() AND is_host = true;
$$;

REVOKE EXECUTE ON FUNCTION public.rb_user_session_ids()      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rb_user_host_session_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rb_user_session_ids()      TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rb_user_host_session_ids() TO anon, authenticated;

-- =============================================
-- REWRITE OFFENDING POLICIES
-- =============================================
-- rb_players: self-referencing SELECT policy was the root cause.
DROP POLICY IF EXISTS "rb read session players" ON public.rb_players;
CREATE POLICY "rb read session players" ON public.rb_players FOR SELECT
  USING (session_id IN (SELECT public.rb_user_session_ids()));

-- rb_sessions: subqueried rb_players -> recursed via the policy above.
DROP POLICY IF EXISTS "rb read own sessions" ON public.rb_sessions;
CREATE POLICY "rb read own sessions" ON public.rb_sessions FOR SELECT
  USING (id IN (SELECT public.rb_user_session_ids()));

-- rb_rounds: read + host-insert both subqueried rb_players.
DROP POLICY IF EXISTS "rb read session rounds" ON public.rb_rounds;
CREATE POLICY "rb read session rounds" ON public.rb_rounds FOR SELECT
  USING (session_id IN (SELECT public.rb_user_session_ids()));

DROP POLICY IF EXISTS "rb host inserts round" ON public.rb_rounds;
CREATE POLICY "rb host inserts round" ON public.rb_rounds FOR INSERT
  WITH CHECK (session_id IN (SELECT public.rb_user_host_session_ids()));

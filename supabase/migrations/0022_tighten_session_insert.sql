-- Tighten session INSERT from WITH CHECK (true) to require the inserter be the
-- host. Sessions are created via the SECURITY DEFINER *_create_session_with_host
-- RPCs (which bypass RLS), so this only constrains the otherwise-unused direct
-- insert path, closing host_id spoofing / junk-row creation.
DROP POLICY IF EXISTS "create session" ON public.sessions;
CREATE POLICY "create session" ON public.sessions FOR INSERT
  WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "rb create session" ON public.rb_sessions;
CREATE POLICY "rb create session" ON public.rb_sessions FOR INSERT
  WITH CHECK (host_id = auth.uid());

-- Phase 1.4 — Realtime authorization for private channels.
--
-- Recent supabase-js (>= 2.50) requires `config: { private: true }` on the
-- channel for postgres_changes events to be delivered to RLS-gated tables.
-- Private channels in turn need an RLS policy on realtime.messages that
-- says "this user is allowed to subscribe to this topic name".
--
-- Topic convention: `session:<sessionId>` — a player may read their own
-- session's channel iff they have a player row with that session_id.

drop policy if exists "session channel subscribers" on realtime.messages;

create policy "session channel subscribers"
  on realtime.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.players p
      where p.id = auth.uid()
        and 'session:' || p.session_id::text = (select realtime.topic())
    )
  );

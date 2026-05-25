-- Phase 2.5 — let a seeker update their own submission row.
-- Spec §6.2 only had INSERT and SELECT for submissions (assuming the edge
-- function would do the verification UPDATE under service-role). The local
-- decision path (local_high / local_low) needs the client itself to write
-- decision_source / status / is_match / photo_path / verified_at.

drop policy if exists "update own submission" on submissions;
create policy "update own submission" on submissions for update
  using (seeker_id = auth.uid())
  with check (seeker_id = auth.uid());

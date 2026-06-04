-- Storage: allow authenticated users to UPDATE (overwrite) photos.
--
-- The app uploads round/submission photos with `upsert: true`. Overwriting an
-- existing object — e.g. a hider re-taking the target photo within the same
-- round, whose storage path is `${round.id}.jpg` — performs an UPDATE on
-- storage.objects. The original 0001 policy granted INSERT only, so the
-- overwrite was denied and surfaced in the UI as "failed to upload".
--
-- Mirror the existing "auth users write photos" INSERT policy for UPDATE.
-- Bucket isolation + photo_path scoping in the app keep this safe.

drop policy if exists "auth users update photos" on storage.objects;
create policy "auth users update photos" on storage.objects for update
  using      (bucket_id in ('round-photos', 'submission-photos') and auth.uid() is not null)
  with check (bucket_id in ('round-photos', 'submission-photos') and auth.uid() is not null);

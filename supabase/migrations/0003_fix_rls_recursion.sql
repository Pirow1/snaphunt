-- Fix infinite recursion in the spec §6.2 RLS policies.
--
-- The original policies look like:
--   create policy "read session players" on players for select
--     using (session_id in (select session_id from players where id = auth.uid()));
--
-- Selecting from `players` triggers the policy, which selects from `players`,
-- which triggers the policy again — Postgres aborts with code 42P17
-- "infinite recursion detected in policy for relation players".
--
-- Standard Supabase fix: hide the recursive subquery inside a SECURITY DEFINER
-- helper that runs with the function-owner's privileges, bypassing RLS. The
-- result set is the user's set of session_ids, which we then `IN`-test in the
-- outer policy. No recursion because the helper does not re-enter the policy.

create or replace function public.my_session_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select session_id from public.players where id = auth.uid();
$$;

revoke execute on function public.my_session_ids() from public;
grant  execute on function public.my_session_ids() to anon, authenticated;

-- Rewrite the recursive policies to use the helper.

drop policy if exists "read own sessions"   on sessions;
create policy "read own sessions" on sessions for select
  using (id in (select public.my_session_ids()));

drop policy if exists "read session players" on players;
create policy "read session players" on players for select
  using (session_id in (select public.my_session_ids()));

drop policy if exists "read session rounds" on rounds;
create policy "read session rounds" on rounds for select
  using (session_id in (select public.my_session_ids()));

drop policy if exists "host inserts round" on rounds;
create policy "host inserts round" on rounds for insert with check (
  exists (
    select 1 from public.players
    where id = auth.uid()
      and is_host = true
      and session_id = rounds.session_id
  )
);

-- submissions.read_own already only joins to rounds (where my own row id is
-- the hider_id), no recursion through players. Left untouched.

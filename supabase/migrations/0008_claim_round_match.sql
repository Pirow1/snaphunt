-- Phase 2.5 — client-callable round-winner claim.
--
-- finalize_round_winner from 0002 was hardened to service_role only (good
-- for the edge function path). For the local-match path the seeker's
-- browser must mark itself as the round winner. We add a separate RPC that:
--   * verifies the caller HAS a verified is_match submission for the round
--     (so a malicious client can't claim a round they didn't actually solve)
--   * atomically updates rounds.winner_id + status='finished' using the
--     same `where status='active'` race-guard as the original
--   * bumps the winner's player.score by point_value
-- Behaviour matches finalize_round_winner once authentication is verified.

create or replace function public.claim_round_match(p_round_id uuid)
returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round rounds%rowtype;
  v_uid uuid := auth.uid();
  v_submission_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  select id into v_submission_id
  from submissions
  where round_id = p_round_id
    and seeker_id = v_uid
    and is_match = true
    and status = 'verified'
  limit 1;

  if v_submission_id is null then
    raise exception 'no matching submission' using errcode = 'P0005';
  end if;

  update rounds
    set winner_id = v_uid,
        status = 'finished',
        ended_at = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;

  if v_round.id is not null then
    update players
      set score = score + v_round.point_value
      where id = v_uid;
  end if;
  return v_round;
end;
$$;

revoke execute on function public.claim_round_match(uuid) from public;
grant  execute on function public.claim_round_match(uuid) to anon, authenticated;

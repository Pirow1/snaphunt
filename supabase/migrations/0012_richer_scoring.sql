-- Phase 3.5 — richer scoring with speed + assists multipliers.
--
-- New formula (server-computed so a malicious client can't inflate):
--   awarded = round(point_value × speed × assists)
--     speed   = greatest(0.4, 1 - elapsed / duration)
--     assists = (hint_used ? 0.85 : 1.0) × power(0.95, sharpen_level)
--
-- Submission row gains points_awarded / hint_used / sharpen_level so the
-- gallery + round-result screens can show the breakdown. Client writes
-- hint_used / sharpen_level on initial INSERT; the win-claim RPCs read
-- them from the row and compute awarded.

alter table submissions
  add column if not exists points_awarded int,
  add column if not exists hint_used      boolean      not null default false,
  add column if not exists sharpen_level  smallint     not null default 0
    check (sharpen_level between 0 and 3);

-- ---------------------------------------------------------------------------
-- Shared helper: read assists state + round duration, return awarded amount.
-- Marked STABLE — no writes, deterministic for a given (round, submission).
-- ---------------------------------------------------------------------------
create or replace function public._snaphunt_compute_awarded(
  p_round_id      uuid,
  p_seeker_id     uuid
) returns int
language plpgsql
stable
set search_path = public
as $$
declare
  v_round       rounds%rowtype;
  v_submission  submissions%rowtype;
  v_elapsed     double precision;
  v_duration    double precision;
  v_speed       double precision;
  v_assists     double precision;
begin
  select * into v_round from rounds where id = p_round_id;
  if v_round.id is null then return 0; end if;

  select * into v_submission
  from submissions
  where round_id = p_round_id and seeker_id = p_seeker_id
  order by created_at desc
  limit 1;
  if v_submission.id is null then return 0; end if;

  -- Speed: linear decay from 1.0 → 0.4 across the round's duration. If
  -- timestamps are missing (shouldn't happen post-Phase 2.2) fall back to 1.0.
  if v_round.started_at is null or v_round.expires_at is null then
    v_speed := 1.0;
  else
    v_elapsed  := greatest(0, extract(epoch from now() - v_round.started_at));
    v_duration := greatest(1, extract(epoch from v_round.expires_at - v_round.started_at));
    v_speed    := greatest(0.4, 1.0 - v_elapsed / v_duration);
  end if;

  v_assists := (case when v_submission.hint_used then 0.85 else 1.0 end)
               * power(0.95, coalesce(v_submission.sharpen_level, 0));

  return greatest(0, round(v_round.point_value * v_speed * v_assists)::int);
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_round_match — local-decided win path (called by seeker browser).
-- Replaces the 1-arg version from 0008. Now writes points_awarded onto the
-- submission and increments player.score by the computed amount.
-- ---------------------------------------------------------------------------
drop function if exists public.claim_round_match(uuid);

create or replace function public.claim_round_match(p_round_id uuid)
returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round         rounds%rowtype;
  v_uid           uuid := auth.uid();
  v_submission_id uuid;
  v_awarded       int;
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
  order by created_at desc
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
    v_awarded := _snaphunt_compute_awarded(p_round_id, v_uid);
    update submissions
      set points_awarded = v_awarded
      where id = v_submission_id;
    update players
      set score = score + v_awarded
      where id = v_uid;
  end if;
  return v_round;
end;
$$;

revoke execute on function public.claim_round_match(uuid) from public;
grant  execute on function public.claim_round_match(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- finalize_round_winner — cloud-decided win path (called by edge function).
-- Same multiplier logic; service-role only. Replaces 0002's body.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_round_winner(p_round_id uuid, p_seeker_id uuid)
returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round         rounds%rowtype;
  v_awarded       int;
  v_submission_id uuid;
begin
  update rounds
    set winner_id = p_seeker_id,
        status = 'finished',
        ended_at = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;

  if v_round.id is not null then
    v_awarded := _snaphunt_compute_awarded(p_round_id, p_seeker_id);

    select id into v_submission_id
    from submissions
    where round_id = p_round_id and seeker_id = p_seeker_id
    order by created_at desc
    limit 1;

    if v_submission_id is not null then
      update submissions set points_awarded = v_awarded where id = v_submission_id;
    end if;

    update players
      set score = score + v_awarded
      where id = p_seeker_id;
  end if;
  return v_round;
end;
$$;

-- Service-role-only access (unchanged from 0002).
revoke execute on function public.finalize_round_winner(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.finalize_round_winner(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- expire_round_no_winner — hider 50% consolation. Also updated to write the
-- awarded amount onto a synthetic submission... actually no, the hider has
-- no submission row. Just keep the existing score bump but make it use the
-- same point_value/2 formula. (No multiplier — hider didn't use assists.)
-- ---------------------------------------------------------------------------
-- (unchanged — still in 0010. No edit needed here.)

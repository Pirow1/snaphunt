-- Harden finalize_round_winner against advisor warnings 0011 + 0028/0029:
--   * pin search_path so the SECURITY DEFINER body can't be shadowed
--   * revoke EXECUTE from anon + authenticated; only service_role calls it
--     (the verify-submission edge function uses the service-role client).

create or replace function finalize_round_winner(p_round_id uuid, p_seeker_id uuid)
returns rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round rounds%rowtype;
begin
  update rounds
    set winner_id = p_seeker_id,
        status = 'finished',
        ended_at = now()
    where id = p_round_id and status = 'active'
    returning * into v_round;

  if v_round.id is not null then
    update players
      set score = score + v_round.point_value
      where id = p_seeker_id;
  end if;
  return v_round;
end;
$$;

revoke execute on function finalize_round_winner(uuid, uuid) from public, anon, authenticated;
grant  execute on function finalize_round_winner(uuid, uuid) to service_role;

-- Bump default round duration from 10 → 20 minutes for larger play areas.
-- Existing sessions keep whatever was stored in their settings jsonb; this
-- only changes the column DEFAULT, which fires for sessions inserted via
-- create_session_with_host (RPC doesn't pass settings explicitly).

alter table sessions
  alter column settings set default '{
    "rounds_total": 5,
    "round_duration_seconds": 1200,
    "location_tolerance_meters": 30,
    "local_match_threshold": 0.85,
    "local_reject_threshold": 0.55,
    "final_match_threshold": 75
  }'::jsonb;

export type SessionStatus = 'lobby' | 'playing' | 'finished';
export type RoundStatus   = 'pending' | 'active' | 'finished';
export type SubmissionStatus = 'pending' | 'verified' | 'error';

export type SessionSettings = {
  rounds_total: number;
  location_tolerance_meters: number;
  local_match_threshold: number;
  local_reject_threshold: number;
  final_match_threshold: number;
};

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  rounds_total: 3,
  location_tolerance_meters: 30,
  local_match_threshold: 0.85,
  local_reject_threshold: 0.55,
  final_match_threshold: 75,
};

export const BOMB_TIMER_OPTIONS = [
  { label: '3 min',  seconds: 180  },
  { label: '5 min',  seconds: 300  },
  { label: '10 min', seconds: 600  },
  { label: '15 min', seconds: 900  },
] as const;

export type BombTimerSeconds = typeof BOMB_TIMER_OPTIONS[number]['seconds'];

export type Session = {
  id: string;
  code: string;
  host_id: string;
  status: SessionStatus;
  current_round_id: string | null;
  settings: SessionSettings;
  created_at: string;
  finished_at: string | null;
};

export type Player = {
  id: string;
  session_id: string;
  name: string;
  emoji: string;
  score: number;
  is_host: boolean;
  joined_at: string;
  last_seen_at: string;
};

export type Round = {
  id: string;
  session_id: string;
  round_number: number;
  planter_id: string;
  photo_path: string | null;
  photo_embedding: number[] | null;
  bomb_timer_seconds: number;
  status: RoundStatus;
  winner_id: string | null;
  planter_lat: number | null;
  planter_lng: number | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type Submission = {
  id: string;
  round_id: string;
  defuser_id: string;
  photo_path: string | null;
  local_similarity: number | null;
  cloud_similarity: number | null;
  cloud_reasoning: string | null;
  is_match: boolean | null;
  defuser_lat: number;
  defuser_lng: number;
  distance_meters: number | null;
  status: SubmissionStatus;
  points_awarded: number | null;
  created_at: string;
  verified_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      sessions:    { Row: Session;    Insert: Partial<Session>    & Pick<Session,    'code' | 'host_id'>; Update: Partial<Session>;    Relationships: [] };
      players:     { Row: Player;     Insert: Partial<Player>     & Pick<Player,     'id' | 'session_id' | 'name'>; Update: Partial<Player>;     Relationships: [] };
      rounds:      { Row: Round;      Insert: Partial<Round>      & Pick<Round,      'session_id' | 'round_number' | 'planter_id'>; Update: Partial<Round>;      Relationships: [] };
      submissions: { Row: Submission; Insert: Partial<Submission> & Pick<Submission, 'round_id' | 'defuser_id' | 'defuser_lat' | 'defuser_lng'>; Update: Partial<Submission>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      rb_create_session_with_host: { Args: { p_session_id: string; p_code: string; p_name: string; p_emoji: string }; Returns: Session };
      rb_join_session_by_code:     { Args: { p_code: string; p_name: string; p_emoji: string }; Returns: Session };
      rb_start_next_round:         { Args: { p_session_id: string; p_planter_id: string; p_round_number: number }; Returns: Round };
      rb_expire_round_no_winner:   { Args: { p_round_id: string }; Returns: Round };
      rb_claim_round_defused:      { Args: { p_round_id: string }; Returns: Round };
    };
  };
};

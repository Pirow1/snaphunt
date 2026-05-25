// Shared TS types — mirror the Postgres schema in
// supabase/migrations/0001_init.sql.

export type SessionStatus = 'lobby' | 'playing' | 'finished';
export type RoundStatus = 'pending' | 'active' | 'finished';
export type SubmissionStatus = 'pending' | 'verified' | 'error';
export type Difficulty = 'easy' | 'medium' | 'legendary';
export type DecisionSource = 'local_high' | 'local_low' | 'cloud';

export type SessionSettings = {
  rounds_total: number;
  round_duration_seconds: number;
  location_tolerance_meters: number;
  local_match_threshold: number;
  local_reject_threshold: number;
  final_match_threshold: number;
};

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
  hider_id: string;
  photo_path: string | null;
  photo_embedding: number[] | null;
  hint: string | null;
  difficulty: Difficulty;
  point_value: number;
  hider_lat: number | null;
  hider_lng: number | null;
  status: RoundStatus;
  winner_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type Submission = {
  id: string;
  round_id: string;
  seeker_id: string;
  photo_path: string | null;
  local_similarity: number | null;
  cloud_similarity: number | null;
  cloud_reasoning: string | null;
  is_match: boolean | null;
  decision_source: DecisionSource | null;
  seeker_lat: number;
  seeker_lng: number;
  distance_meters: number | null;
  status: SubmissionStatus;
  created_at: string;
  verified_at: string | null;
};

// Minimal `Database` type for Supabase generic client typing.
export type Database = {
  public: {
    Tables: {
      sessions:    { Row: Session;    Insert: Partial<Session>    & Pick<Session,    'code' | 'host_id'>; Update: Partial<Session> };
      players:     { Row: Player;     Insert: Partial<Player>     & Pick<Player,     'id' | 'session_id' | 'name'>; Update: Partial<Player> };
      rounds:      { Row: Round;      Insert: Partial<Round>      & Pick<Round,      'session_id' | 'round_number' | 'hider_id'>; Update: Partial<Round> };
      submissions: { Row: Submission; Insert: Partial<Submission> & Pick<Submission, 'round_id' | 'seeker_id' | 'seeker_lat' | 'seeker_lng'>; Update: Partial<Submission> };
    };
  };
};

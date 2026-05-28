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

// Mirrors the DB-side default on the sessions.settings column. Keep in sync
// with supabase/migrations/0001_init.sql.
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  rounds_total: 5,
  round_duration_seconds: 1200,
  location_tolerance_meters: 30,
  local_match_threshold: 0.85,
  local_reject_threshold: 0.55,
  final_match_threshold: 75,
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
  user_profile_id: string | null;
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
  // Phase 3.5 — scoring breakdown. Set by the client at INSERT time (assists)
  // and by the win-claim RPC (points_awarded) after a successful match.
  hint_used: boolean;
  sharpen_level: number;
  points_awarded: number | null;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  emoji: string;
  created_at: string;
};

// Minimal `Database` type for Supabase generic client typing.
export type Database = {
  public: {
    Tables: {
      sessions:      { Row: Session;     Insert: Partial<Session>     & Pick<Session,     'code' | 'host_id'>; Update: Partial<Session> };
      players:       { Row: Player;      Insert: Partial<Player>      & Pick<Player,      'id' | 'session_id' | 'name'>; Update: Partial<Player> };
      rounds:        { Row: Round;       Insert: Partial<Round>       & Pick<Round,       'session_id' | 'round_number' | 'hider_id'>; Update: Partial<Round> };
      submissions:   { Row: Submission;  Insert: Partial<Submission>  & Pick<Submission,  'round_id' | 'seeker_id' | 'seeker_lat' | 'seeker_lng'>; Update: Partial<Submission> };
      user_profiles: { Row: UserProfile; Insert: Partial<UserProfile> & Pick<UserProfile, 'name'>; Update: Partial<UserProfile> };
    };
    Functions: {
      create_session_with_host: {
        Args: { p_session_id: string; p_code: string; p_name: string; p_emoji: string; p_user_profile_id?: string | null };
        Returns: Session;
      };
      join_session_by_code: {
        Args: { p_code: string; p_name: string; p_emoji: string; p_user_profile_id?: string | null };
        Returns: Session;
      };
      find_user_by_contact: {
        Args: { p_email?: string | null; p_phone?: string | null };
        Returns: UserProfile[];
      };
    };
  };
};

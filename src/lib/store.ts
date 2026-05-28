import { create } from 'zustand';
import { supabase } from './supabase';
import { generateJoinCode } from './codes';
import { compressedPhoto } from './camera';
import { encodeImage } from './vision';
import { cosine, deserializeEmbedding, serializeEmbedding } from './embeddings';
import { getCurrentCoords, haversine } from './geolocation';
import { DEFAULT_SESSION_SETTINGS, type Difficulty, type Player, type Round, type Session, type SessionStatus, type Submission } from './types';

const POINTS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 50,
  medium: 100,
  legendary: 250,
};

// Zustand store skeleton — slices per spec §11.1:
// identity, session, current round, geolocation, compass heading,
// submissions, vision-load-progress, toast.
//
// Slices are filled in as the corresponding phase lands; for Phase 1.2 we
// only need `identity` (authUserId + display info) and a couple of setters.
// Other slices are left here so later phases just populate them.

export type Identity = {
  authUserId: string | null;
  name: string;
  emoji: string;
  userProfileId: string | null;
  photoUrl: string | null;
};

export type GeoCoords = { lat: number; lng: number; accuracy?: number };

export type Toast = {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
};

export type AppState = {
  // identity
  identity: Identity;
  setAuthUserId: (id: string | null) => void;
  setIdentity: (patch: Partial<Identity>) => void;
  setUserProfile: (profileId: string, photoUrl: string | null) => void;

  // session
  session: Session | null;
  players: Player[];
  setSession: (s: Session | null) => void;
  setPlayers: (p: Player[]) => void;
  createSession: (args: { name: string; emoji: string; userProfileId?: string | null }) => Promise<{ sessionId: string; code: string }>;
  joinSession: (args: { code: string; name: string; emoji: string; userProfileId?: string | null }) => Promise<{ sessionId: string; status: SessionStatus }>;
  startGame: () => Promise<{ roundId: string; hiderId: string }>;
  startNextRound: () => Promise<{ roundId: string; hiderId: string } | null>;
  finishSession: () => Promise<void>;
  expireRoundNoWinner: () => Promise<void>;
  setTrap: (args: { file: File | Blob; difficulty: Difficulty; hint: string }) => Promise<{ roundId: string }>;
  submitGuess: (args: { file: File | Blob }) => Promise<{
    branch: 'local_high' | 'local_low' | 'cloud';
    submissionId: string;
    localSimilarity: number;
    distanceMeters: number;
  }>;

  currentSubmissionId: string | null;
  setCurrentSubmissionId: (id: string | null) => void;

  // Seeker assists for the current round. Reset on round.id change in
  // GameRouter so each new round starts clean.
  hintUsed: boolean;
  sharpenLevel: 0 | 1 | 2 | 3;
  setHintUsed: (used: boolean) => void;
  setSharpenLevel: (level: 0 | 1 | 2 | 3) => void;
  resetAssists: () => void;

  // current round
  currentRound: Round | null;
  setCurrentRound: (r: Round | null) => void;

  // geolocation
  coords: GeoCoords | null;
  setCoords: (c: GeoCoords | null) => void;

  // compass
  heading: number | null;
  setHeading: (deg: number | null) => void;

  // submissions (for the current round, by id)
  submissions: Record<string, Submission>;
  upsertSubmission: (s: Submission) => void;
  clearSubmissions: () => void;

  // vision load progress (0-100)
  visionLoadProgress: number;
  visionReady: boolean;
  setVisionLoadProgress: (pct: number) => void;
  setVisionReady: (ready: boolean) => void;

  // dev/diagnostic: last distance the seeker broadcast via presence
  lastTrackedDistance: number | null;
  setLastTrackedDistance: (d: number | null) => void;

  // toast queue
  toasts: Toast[];
  pushToast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
};

let toastSeq = 0;

export const useStore = create<AppState>()((set) => ({
  identity: { authUserId: null, name: '', emoji: '🦊', userProfileId: null, photoUrl: null },
  setAuthUserId: (id) =>
    set((s) => ({ identity: { ...s.identity, authUserId: id } })),
  setIdentity: (patch) =>
    set((s) => ({ identity: { ...s.identity, ...patch } })),
  setUserProfile: (profileId, photoUrl) =>
    set((s) => ({ identity: { ...s.identity, userProfileId: profileId, photoUrl } })),

  session: null,
  players: [],
  setSession: (session) => set({ session }),
  setPlayers: (players) => set({ players }),

  createSession: async ({ name, emoji, userProfileId }) => {
    const userId = useStore.getState().identity.authUserId;
    if (!userId) throw new Error('Not authenticated yet — wait for anon sign-in to finish.');

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 24) {
      throw new Error('Name must be 1–24 characters.');
    }

    // Pre-generate the session id; atomic RPC handles both session + host
    // player inserts under SECURITY DEFINER, sidestepping RLS chicken-and-egg.
    const sessionId = crypto.randomUUID();

    // Retry on unique-code collision (23505).
    let code = '';
    let lastErr: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateJoinCode();
      const { error } = await supabase.rpc('create_session_with_host', {
        p_session_id: sessionId,
        p_code: code,
        p_name: trimmedName,
        p_emoji: emoji,
        p_user_profile_id: userProfileId ?? null,
      });
      if (!error) { lastErr = null; break; }
      lastErr = error;
      if (error.code !== '23505') throw error;
      if (attempt === 4) throw new Error('Could not generate a unique join code, please try again.');
    }
    if (lastErr) throw lastErr;

    // Optimistic local state — realtime subscription in Phase 1.4 will overwrite.
    const now = new Date().toISOString();
    set((s) => ({
      identity: { ...s.identity, name: trimmedName, emoji },
      session: {
        id: sessionId,
        code,
        host_id: userId,
        status: 'lobby',
        current_round_id: null,
        settings: { ...DEFAULT_SESSION_SETTINGS },
        created_at: now,
        finished_at: null,
      },
      players: [
        {
          id: userId,
          session_id: sessionId,
          name: trimmedName,
          emoji,
          score: 0,
          is_host: true,
          joined_at: now,
          last_seen_at: now,
        },
      ],
    }));

    return { sessionId, code };
  },

  joinSession: async ({ code, name, emoji, userProfileId }) => {
    const userId = useStore.getState().identity.authUserId;
    if (!userId) throw new Error('Not authenticated yet — wait for anon sign-in to finish.');

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 24) {
      throw new Error('Name must be 1–24 characters.');
    }

    const { data, error } = await supabase.rpc('join_session_by_code', {
      p_code: code,
      p_name: trimmedName,
      p_emoji: emoji,
      p_user_profile_id: userProfileId ?? null,
    });
    if (error) {
      // Map known sqlstates to friendly messages.
      switch (error.code) {
        case 'P0002': throw new Error('That code doesn’t match an active hunt.');
        case 'P0003': throw new Error('That hunt has already finished.');
        default: throw error;
      }
    }
    const session = data as Session;
    set((s) => ({
      identity: { ...s.identity, name: trimmedName, emoji },
      session,
    }));
    return { sessionId: session.id, status: session.status };
  },

  startGame: async () => {
    const state = useStore.getState();
    const session = state.session;
    const players = state.players;
    const userId = state.identity.authUserId;

    if (!session || !userId) throw new Error('No active session.');
    if (session.host_id !== userId) throw new Error('Only the host can start the hunt.');
    if (players.length < 2) throw new Error(`Need at least 2 players (have ${players.length}).`);

    // Random hider for round 1.
    const hider = players[Math.floor(Math.random() * players.length)]!;

    // Pre-generate the round id so we never need to .select() under RLS.
    const roundId = crypto.randomUUID();
    const { error: rErr } = await supabase.from('rounds').insert({
      id: roundId,
      session_id: session.id,
      round_number: 1,
      hider_id: hider.id,
      status: 'pending',
      difficulty: 'easy',
      point_value: 50,
    });
    if (rErr) throw rErr;

    const { error: sErr } = await supabase
      .from('sessions')
      .update({ status: 'playing', current_round_id: roundId })
      .eq('id', session.id);
    if (sErr) throw sErr;

    return { roundId, hiderId: hider.id };
  },

  // Host-only: create the next round with a rotated hider (next in join order
  // by joined_at). Returns null when rounds_total has been reached — caller
  // should then finishSession().
  startNextRound: async () => {
    const state = useStore.getState();
    const session = state.session;
    const players = state.players;
    const round = state.currentRound;
    const userId = state.identity.authUserId;

    if (!session || !round || !userId) throw new Error('No active session.');
    if (session.host_id !== userId) throw new Error('Only the host can advance rounds.');
    if (round.round_number >= session.settings.rounds_total) return null;

    // Rotate the hider by join order. players[] from useSession is already
    // sorted by joined_at; current hider's index advances by 1.
    const sorted = players.slice().sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    const currentIdx = sorted.findIndex((p) => p.id === round.hider_id);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % sorted.length : 0;
    const nextHider = sorted[nextIdx]!;
    const nextNumber = round.round_number + 1;

    const { data, error } = await supabase.rpc('start_next_round', {
      p_session_id: session.id,
      p_hider_id: nextHider.id,
      p_round_number: nextNumber,
    });
    if (error) throw error;
    return { roundId: (data as Round).id, hiderId: nextHider.id };
  },

  // Host-only: mark the session 'finished' after rounds_total has been
  // reached. Realtime broadcast pushes the new status to all clients;
  // GameRouter navigates everyone to /gallery/:sessionId.
  finishSession: async () => {
    const state = useStore.getState();
    const session = state.session;
    const userId = state.identity.authUserId;
    if (!session || !userId) return;
    if (session.host_id !== userId) return;
    if (session.status === 'finished') return;
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'finished', finished_at: new Date().toISOString() })
      .eq('id', session.id);
    if (error) throw error;
  },

  // Host-only: close out an active round whose timer hit zero with no
  // matches. Awards the hider a 50% consolation bonus (point_value / 2).
  expireRoundNoWinner: async () => {
    const state = useStore.getState();
    const round = state.currentRound;
    const session = state.session;
    const userId = state.identity.authUserId;
    if (!round || !session || !userId) return;
    if (session.host_id !== userId) return;
    if (round.status !== 'active') return;
    const { error } = await supabase.rpc('expire_round_no_winner', {
      p_round_id: round.id,
    });
    if (error) throw error;
  },

  setTrap: async ({ file, difficulty, hint }) => {
    // The architectural heart of Pillar 1 (spec §9.5):
    //   compress → encode (CLIP) → upload → update round in one async tx.
    const state = useStore.getState();
    const round = state.currentRound;
    const session = state.session;
    const userId = state.identity.authUserId;

    if (!session || !round || !userId) throw new Error('No active round.');
    if (round.hider_id !== userId) throw new Error('Only the hider can set the trap.');

    // 1) Compress + encode in parallel where possible.
    const compressed = await compressedPhoto(file);
    const embedding = await encodeImage(compressed);

    // 2) GPS pin. Awaited after encode so the user only sees one async step
    //    visually ("encoding…"). If the user denies location we surface it.
    const coords = await getCurrentCoords();

    // 3) Upload to round-photos/<roundId>.jpg (upsert in case of re-trap).
    const path = `${round.id}.jpg`;
    const { error: upErr } = await supabase.storage
      .from('round-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    // 4) Update the round row atomically.
    const durationSec = session.settings.round_duration_seconds ?? 1200;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationSec * 1000);

    const { error: rErr } = await supabase
      .from('rounds')
      .update({
        photo_path: path,
        photo_embedding: serializeEmbedding(embedding),
        hint: hint.trim() || null,
        difficulty,
        point_value: POINTS_BY_DIFFICULTY[difficulty],
        hider_lat: coords.lat,
        hider_lng: coords.lng,
        status: 'active',
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq('id', round.id);
    if (rErr) throw rErr;

    // Optimistic local — realtime broadcast will follow.
    set((s) => ({
      currentRound: s.currentRound
        ? {
            ...s.currentRound,
            photo_path: path,
            photo_embedding: serializeEmbedding(embedding),
            hint: hint.trim() || null,
            difficulty,
            point_value: POINTS_BY_DIFFICULTY[difficulty],
            hider_lat: coords.lat,
            hider_lng: coords.lng,
            status: 'active',
            started_at: startedAt.toISOString(),
            expires_at: expiresAt.toISOString(),
          }
        : null,
      coords,
    }));

    return { roundId: round.id };
  },

  currentRound: null,
  setCurrentRound: (currentRound) => set({ currentRound }),

  coords: null,
  setCoords: (coords) => set({ coords }),

  heading: null,
  setHeading: (heading) => set({ heading }),

  submissions: {},
  upsertSubmission: (sub) =>
    set((s) => ({ submissions: { ...s.submissions, [sub.id]: sub } })),
  clearSubmissions: () => set({ submissions: {} }),

  visionLoadProgress: 0,
  visionReady: false,
  setVisionLoadProgress: (pct) => set({ visionLoadProgress: pct }),
  setVisionReady: (ready) => set({ visionReady: ready }),

  lastTrackedDistance: null,
  setLastTrackedDistance: (d) => set({ lastTrackedDistance: d }),

  currentSubmissionId: null,
  setCurrentSubmissionId: (id) => set({ currentSubmissionId: id }),

  hintUsed: false,
  sharpenLevel: 0,
  setHintUsed: (used) => set({ hintUsed: used }),
  setSharpenLevel: (level) => set({ sharpenLevel: level }),
  resetAssists: () => set({ hintUsed: false, sharpenLevel: 0 }),

  submitGuess: async ({ file }) => {
    const state = useStore.getState();
    const round = state.currentRound;
    const session = state.session;
    const userId = state.identity.authUserId;
    const coords = state.coords;

    if (!round || !session || !userId) throw new Error('No active round.');
    if (!coords) throw new Error('Waiting for GPS — try again in a moment.');
    if (!round.photo_embedding || round.hider_lat === null || round.hider_lng === null) {
      throw new Error('Round not ready yet.');
    }
    if (round.hider_id === userId) throw new Error("Hiders can't submit.");

    const compressed = await compressedPhoto(file);
    const seekerEmbedding = await encodeImage(compressed);
    const hiderEmbedding = deserializeEmbedding(round.photo_embedding);
    const localSim = cosine(seekerEmbedding, hiderEmbedding);

    const distM = haversine(coords, { lat: round.hider_lat, lng: round.hider_lng, accuracy: 0 });
    const s = session.settings;
    const withinRange = distM <= s.location_tolerance_meters;

    const submissionId = crypto.randomUUID();
    const baseRow = {
      id: submissionId,
      round_id: round.id,
      seeker_id: userId,
      local_similarity: localSim,
      seeker_lat: coords.lat,
      seeker_lng: coords.lng,
      distance_meters: distM,
      hint_used: state.hintUsed,
      sharpen_level: state.sharpenLevel,
    };

    const { error: insErr } = await supabase.from('submissions').insert(baseRow);
    if (insErr) throw insErr;
    set({ currentSubmissionId: submissionId });

    if (localSim >= s.local_match_threshold && withinRange) {
      const path = `${submissionId}.jpg`;
      await supabase.storage
        .from('submission-photos')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
      await supabase.from('submissions').update({
        photo_path: path,
        is_match: true,
        decision_source: 'local_high',
        status: 'verified',
        verified_at: new Date().toISOString(),
      }).eq('id', submissionId);
      // Claim the win — atomic, only the first match per round actually flips status.
      await supabase.rpc('claim_round_match', { p_round_id: round.id });
      return { branch: 'local_high', submissionId, localSimilarity: localSim, distanceMeters: distM };
    }

    if (localSim < s.local_reject_threshold) {
      await supabase.from('submissions').update({
        is_match: false,
        decision_source: 'local_low',
        status: 'verified',
        verified_at: new Date().toISOString(),
      }).eq('id', submissionId);
      return { branch: 'local_low', submissionId, localSimilarity: localSim, distanceMeters: distM };
    }

    // Cloud-escalation branch. Upload photo; the edge function (Phase 3.1)
    // will read it via signed URL. For Phase 2.5 we STUB it inline.
    const path = `${submissionId}.jpg`;
    await supabase.storage
      .from('submission-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
    await supabase.from('submissions').update({ photo_path: path }).eq('id', submissionId);

    // Pillar 3 — Claude tool use via verify-submission edge function.
    // The function owns all DB writes for this branch (cloud_similarity,
    // cloud_reasoning, is_match, decision_source='cloud', status, verified_at)
    // and atomically calls finalize_round_winner on match.
    // Fire-and-await in the background so the UI can show VerifyingScreen;
    // ResultScreen subscribes to the submission row and renders when status flips.
    void supabase.functions
      .invoke('verify-submission', { body: { submission_id: submissionId } })
      .then(({ error }) => {
        if (error) {
          // Surface the error on the submission row so GameRouter can route
          // back to the hunt; also raise a toast for visibility.
          void supabase
            .from('submissions')
            .update({ status: 'error' })
            .eq('id', submissionId);
          useStore.getState().pushToast(
            'Cloud verification failed — try again.',
            'error',
          );
        }
      });

    return { branch: 'cloud', submissionId, localSimilarity: localSim, distanceMeters: distM };
  },

  toasts: [],
  pushToast: (text, tone = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, text, tone }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

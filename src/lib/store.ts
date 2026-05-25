import { create } from 'zustand';
import { supabase } from './supabase';
import { generateJoinCode } from './codes';
import { compressedPhoto } from './camera';
import { encodeImage } from './vision';
import { serializeEmbedding } from './embeddings';
import { getCurrentCoords } from './geolocation';
import { DEFAULT_SESSION_SETTINGS, type Difficulty, type Player, type Round, type Session, type Submission } from './types';

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

  // session
  session: Session | null;
  players: Player[];
  setSession: (s: Session | null) => void;
  setPlayers: (p: Player[]) => void;
  createSession: (args: { name: string; emoji: string }) => Promise<{ sessionId: string; code: string }>;
  joinSession: (args: { code: string; name: string; emoji: string }) => Promise<{ sessionId: string }>;
  startGame: () => Promise<{ roundId: string; hiderId: string }>;
  setTrap: (args: { file: File | Blob; difficulty: Difficulty; hint: string }) => Promise<{ roundId: string }>;

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

  // toast queue
  toasts: Toast[];
  pushToast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
};

let toastSeq = 0;

export const useStore = create<AppState>((set) => ({
  identity: { authUserId: null, name: '', emoji: '🦊' },
  setAuthUserId: (id) =>
    set((s) => ({ identity: { ...s.identity, authUserId: id } })),
  setIdentity: (patch) =>
    set((s) => ({ identity: { ...s.identity, ...patch } })),

  session: null,
  players: [],
  setSession: (session) => set({ session }),
  setPlayers: (players) => set({ players }),

  createSession: async ({ name, emoji }) => {
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

  joinSession: async ({ code, name, emoji }) => {
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
    });
    if (error) {
      // Map known sqlstates to friendly messages.
      switch (error.code) {
        case 'P0002': throw new Error('That code doesn’t match an active hunt.');
        case 'P0003': throw new Error('That hunt has already started.');
        default: throw error;
      }
    }
    const session = data as Session;
    set((s) => ({
      identity: { ...s.identity, name: trimmedName, emoji },
      session,
    }));
    return { sessionId: session.id };
  },

  startGame: async () => {
    const state = useStore.getState();
    const session = state.session;
    const players = state.players;
    const userId = state.identity.authUserId;

    if (!session || !userId) throw new Error('No active session.');
    if (session.host_id !== userId) throw new Error('Only the host can start the hunt.');
    if (players.length < 3) throw new Error(`Need at least 3 players (have ${players.length}).`);

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
    const durationSec = session.settings.round_duration_seconds ?? 600;
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

  toasts: [],
  pushToast: (text, tone = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, text, tone }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

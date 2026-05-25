import { create } from 'zustand';
import { supabase } from './supabase';
import { generateJoinCode } from './codes';
import { DEFAULT_SESSION_SETTINGS, type Player, type Round, type Session, type Submission } from './types';

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

    // Pre-generate the session id so we never need to .select() under RLS
    // (the "read own sessions" policy depends on the player row, which we
    // haven't inserted yet at the moment of session insert).
    const sessionId = crypto.randomUUID();

    // Try a few codes in case of unique-constraint collision (23505).
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateJoinCode();
      const { error } = await supabase
        .from('sessions')
        .insert({ id: sessionId, code, host_id: userId });
      if (!error) break;
      if (error.code !== '23505') throw error;
      if (attempt === 4) throw new Error('Could not generate a unique join code, please try again.');
    }

    const { error: playerErr } = await supabase.from('players').insert({
      id: userId,
      session_id: sessionId,
      name: trimmedName,
      emoji,
      is_host: true,
    });
    if (playerErr) throw playerErr;

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

import { create } from 'zustand';
import type { Player, Round, Session, Submission } from './types';

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

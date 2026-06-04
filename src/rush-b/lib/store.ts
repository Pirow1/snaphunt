import { create, type UseBoundStore, type StoreApi } from 'zustand';
import { supabase } from './supabase';
import { generateJoinCode } from './codes';
import { compressedPhoto } from './camera';
import { encodeImage } from './vision';
import { cosine, deserializeEmbedding, serializeEmbedding } from './embeddings';
import { getCurrentCoords, haversine } from './geolocation';
import { DEFAULT_SESSION_SETTINGS, type Player, type Round, type Session, type SessionStatus, type Submission } from './types';

export type Identity = { authUserId: string | null; name: string; emoji: string; userProfileId: string | null; photoUrl: string | null };
export type GeoCoords = { lat: number; lng: number; accuracy: number };
export type Toast = { id: number; text: string; tone: 'info' | 'success' | 'error' };

export type AppState = {
  identity: Identity;
  setAuthUserId: (id: string | null) => void;
  setIdentity: (patch: Partial<Identity>) => void;
  setUserProfile: (profileId: string, photoUrl: string | null) => void;

  session: Session | null;
  players: Player[];
  setSession: (s: Session | null) => void;
  setPlayers: (p: Player[]) => void;
  createSession: (args: { name: string; emoji: string; userProfileId?: string | null }) => Promise<{ sessionId: string; code: string }>;
  joinSession: (args: { code: string; name: string; emoji: string; userProfileId?: string | null }) => Promise<{ sessionId: string; status: SessionStatus }>;
  startGame: () => Promise<{ roundId: string; planterId: string }>;
  startNextRound: () => Promise<{ roundId: string; planterId: string } | null>;
  finishSession: () => Promise<void>;
  expireRoundNoWinner: () => Promise<void>;

  plantBomb: (args: { file: File | Blob; bombTimerSeconds: number }) => Promise<{ roundId: string }>;
  submitGuess: (args: { file: File | Blob }) => Promise<{
    branch: 'local_high' | 'local_low' | 'cloud';
    submissionId: string;
    localSimilarity: number;
    distanceMeters: number;
  }>;

  currentSubmissionId: string | null;
  setCurrentSubmissionId: (id: string | null) => void;

  currentRound: Round | null;
  setCurrentRound: (r: Round | null) => void;

  coords: GeoCoords | null;
  setCoords: (c: GeoCoords | null) => void;

  heading: number | null;
  setHeading: (deg: number | null) => void;

  submissions: Record<string, Submission>;
  upsertSubmission: (s: Submission) => void;
  clearSubmissions: () => void;

  visionLoadProgress: number;
  visionReady: boolean;
  setVisionLoadProgress: (pct: number) => void;
  setVisionReady: (ready: boolean) => void;

  lastTrackedDistance: number | null;
  setLastTrackedDistance: (d: number | null) => void;

  toasts: Toast[];
  pushToast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
};

let toastSeq = 0;

export const useStore: UseBoundStore<StoreApi<AppState>> = create<AppState>()((set) => ({
  identity: { authUserId: null, name: '', emoji: '💣', userProfileId: null, photoUrl: null },
  setAuthUserId: (id) => set((s) => ({ identity: { ...s.identity, authUserId: id } })),
  setIdentity: (patch) => set((s) => ({ identity: { ...s.identity, ...patch } })),
  setUserProfile: (profileId, photoUrl) =>
    set((s) => ({ identity: { ...s.identity, userProfileId: profileId, photoUrl } })),

  session: null,
  players: [],
  setSession: (session) => set({ session }),
  setPlayers: (players) => set({ players }),

  createSession: async ({ name, emoji, userProfileId }) => {
    const userId = useStore.getState().identity.authUserId;
    if (!userId) throw new Error('Not authenticated yet.');
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 24) throw new Error('Name must be 1–24 characters.');

    const sessionId = crypto.randomUUID();
    let code = '';
    let lastErr: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateJoinCode();
      const { error } = await supabase.rpc('rb_create_session_with_host', {
        p_session_id: sessionId, p_code: code, p_name: trimmedName, p_emoji: emoji,
        p_user_profile_id: userProfileId ?? null,
      });
      if (!error) { lastErr = null; break; }
      lastErr = error;
      if (error.code !== '23505') throw error;
      if (attempt === 4) throw new Error('Could not generate a unique code, please try again.');
    }
    if (lastErr) throw lastErr;

    const now = new Date().toISOString();
    set((s) => ({
      identity: { ...s.identity, name: trimmedName, emoji },
      session: {
        id: sessionId, code, host_id: userId, status: 'lobby',
        current_round_id: null, settings: { ...DEFAULT_SESSION_SETTINGS },
        created_at: now, finished_at: null,
      },
      players: [{ id: userId, session_id: sessionId, name: trimmedName, emoji, score: 0, is_host: true, joined_at: now, last_seen_at: now }],
    }));
    return { sessionId, code };
  },

  joinSession: async ({ code, name, emoji, userProfileId }) => {
    const userId = useStore.getState().identity.authUserId;
    if (!userId) throw new Error('Not authenticated yet.');
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 24) throw new Error('Name must be 1–24 characters.');

    const { data, error } = await supabase.rpc('rb_join_session_by_code', {
      p_code: code, p_name: trimmedName, p_emoji: emoji,
      p_user_profile_id: userProfileId ?? null,
    });
    if (error) {
      switch (error.code) {
        case 'P0002': throw new Error("That code doesn't match an active operation.");
        case 'P0003': throw new Error('That operation has already ended.');
        default: throw error;
      }
    }
    const session = data as Session;
    set((s) => ({ identity: { ...s.identity, name: trimmedName, emoji }, session }));
    return { sessionId: session.id, status: session.status };
  },

  startGame: async () => {
    const { session, players, identity } = useStore.getState();
    if (!session || !identity.authUserId) throw new Error('No active session.');
    if (session.host_id !== identity.authUserId) throw new Error('Only the host can start.');
    if (players.length < 2) throw new Error(`Need at least 2 players (have ${players.length}).`);

    const planter = players[Math.floor(Math.random() * players.length)]!;
    const roundId = crypto.randomUUID();
    const { error: rErr } = await supabase.from('rb_rounds').insert({
      id: roundId, session_id: session.id, round_number: 1,
      planter_id: planter.id, status: 'pending', bomb_timer_seconds: 300,
    });
    if (rErr) throw rErr;

    const { error: sErr } = await supabase.from('rb_sessions')
      .update({ status: 'playing', current_round_id: roundId }).eq('id', session.id);
    if (sErr) throw sErr;

    return { roundId, planterId: planter.id };
  },

  startNextRound: async () => {
    const { session, players, currentRound, identity } = useStore.getState();
    if (!session || !currentRound || !identity.authUserId) throw new Error('No active session.');
    if (session.host_id !== identity.authUserId) throw new Error('Only the host can advance rounds.');
    if (currentRound.round_number >= session.settings.rounds_total) return null;

    const sorted = players.slice().sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    const currentIdx = sorted.findIndex((p) => p.id === currentRound.planter_id);
    const nextPlanter = sorted[(currentIdx >= 0 ? currentIdx + 1 : 0) % sorted.length]!;
    const nextNumber = currentRound.round_number + 1;

    const { data, error } = await supabase.rpc('rb_start_next_round', {
      p_session_id: session.id, p_planter_id: nextPlanter.id, p_round_number: nextNumber,
    });
    if (error) throw error;
    return { roundId: (data as Round).id, planterId: nextPlanter.id };
  },

  finishSession: async () => {
    const { session, identity } = useStore.getState();
    if (!session || !identity.authUserId) return;
    if (session.host_id !== identity.authUserId) return;
    if (session.status === 'finished') return;
    const { error } = await supabase.from('rb_sessions')
      .update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', session.id);
    if (error) throw error;
  },

  expireRoundNoWinner: async () => {
    const { currentRound, session, identity } = useStore.getState();
    if (!currentRound || !session || !identity.authUserId) return;
    if (session.host_id !== identity.authUserId) return;
    if (currentRound.status !== 'active') return;
    const { error } = await supabase.rpc('rb_expire_round_no_winner', { p_round_id: currentRound.id });
    if (error) throw error;
  },

  plantBomb: async ({ file, bombTimerSeconds }) => {
    const { session, currentRound, identity } = useStore.getState();
    if (!session || !currentRound || !identity.authUserId) throw new Error('No active round.');
    if (currentRound.planter_id !== identity.authUserId) throw new Error('Only the planter can plant the bomb.');

    const compressed = await compressedPhoto(file);
    const embedding = await encodeImage(compressed);
    const coords = await getCurrentCoords();

    const path = `${currentRound.id}.jpg`;
    const { error: upErr } = await supabase.storage
      .from('round-photos').upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + bombTimerSeconds * 1000);

    const { error: rErr } = await supabase.from('rb_rounds').update({
      photo_path: path,
      photo_embedding: serializeEmbedding(embedding),
      bomb_timer_seconds: bombTimerSeconds,
      planter_lat: coords.lat,
      planter_lng: coords.lng,
      status: 'active',
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }).eq('id', currentRound.id);
    if (rErr) throw rErr;

    set((s) => ({
      currentRound: s.currentRound ? {
        ...s.currentRound,
        photo_path: path,
        photo_embedding: serializeEmbedding(embedding),
        bomb_timer_seconds: bombTimerSeconds,
        planter_lat: coords.lat,
        planter_lng: coords.lng,
        status: 'active',
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      } : null,
      coords,
    }));
    return { roundId: currentRound.id };
  },

  submitGuess: async ({ file }) => {
    const { currentRound, session, identity, coords } = useStore.getState();
    if (!currentRound || !session || !identity.authUserId) throw new Error('No active round.');
    if (!coords) throw new Error('Waiting for GPS — try again in a moment.');
    if (!currentRound.photo_embedding || currentRound.planter_lat === null) throw new Error('Round not ready yet.');
    if (currentRound.planter_id === identity.authUserId) throw new Error("Planter can't defuse.");

    const compressed = await compressedPhoto(file);
    const defuserEmb = await encodeImage(compressed);
    const planterEmb = deserializeEmbedding(currentRound.photo_embedding);
    const localSim = cosine(defuserEmb, planterEmb);
    const distM = haversine(coords, { lat: currentRound.planter_lat!, lng: currentRound.planter_lng!, accuracy: 0 });
    const s = session.settings;
    const withinRange = distM <= s.location_tolerance_meters;

    const submissionId = crypto.randomUUID();
    const baseRow = {
      id: submissionId,
      round_id: currentRound.id,
      defuser_id: identity.authUserId,
      local_similarity: localSim,
      defuser_lat: coords.lat,
      defuser_lng: coords.lng,
      distance_meters: distM,
    };

    if (localSim >= s.local_match_threshold && withinRange) {
      const path = `submissions/${submissionId}.jpg`;
      await supabase.storage.from('round-photos').upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
      const { error } = await supabase.from('rb_submissions').insert({
        ...baseRow, photo_path: path, is_match: true, status: 'verified',
        verified_at: new Date().toISOString(),
      });
      if (error) throw error;
      set({ currentSubmissionId: submissionId });
      return { branch: 'local_high', submissionId, localSimilarity: localSim, distanceMeters: distM };
    }

    if (localSim < s.local_reject_threshold || !withinRange) {
      const { error } = await supabase.from('rb_submissions').insert({
        ...baseRow, is_match: false, status: 'verified',
        verified_at: new Date().toISOString(),
      });
      if (error) throw error;
      set({ currentSubmissionId: submissionId });
      return { branch: 'local_low', submissionId, localSimilarity: localSim, distanceMeters: distM };
    }

    // Cloud verify
    const path = `submissions/${submissionId}.jpg`;
    await supabase.storage.from('round-photos').upload(path, compressed, { contentType: 'image/jpeg', upsert: true });
    const { error } = await supabase.from('rb_submissions').insert({
      ...baseRow, photo_path: path, status: 'pending',
    });
    if (error) throw error;

    // The edge function owns the verdict write (records cloud_similarity /
    // is_match / status on rb_submissions); we just wait for it.
    const { error: fnErr } = await supabase.functions.invoke('verify-submission', {
      body: { submission_id: submissionId, game: 'rushb' },
    });
    if (fnErr) throw fnErr;

    set({ currentSubmissionId: submissionId });
    return { branch: 'cloud', submissionId, localSimilarity: localSim, distanceMeters: distM };
  },

  currentSubmissionId: null,
  setCurrentSubmissionId: (id) => set({ currentSubmissionId: id }),
  currentRound: null,
  setCurrentRound: (currentRound) => set({ currentRound }),
  coords: null,
  setCoords: (coords) => set({ coords }),
  heading: null,
  setHeading: (heading) => set({ heading }),
  submissions: {},
  upsertSubmission: (sub) => set((s) => ({ submissions: { ...s.submissions, [sub.id]: sub } })),
  clearSubmissions: () => set({ submissions: {} }),
  visionLoadProgress: 0,
  visionReady: false,
  setVisionLoadProgress: (pct) => set({ visionLoadProgress: pct }),
  setVisionReady: (ready) => set({ visionReady: ready }),
  lastTrackedDistance: null,
  setLastTrackedDistance: (d) => set({ lastTrackedDistance: d }),

  toasts: [],
  pushToast: (text, tone = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastSeq, text, tone }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// State-machine screen at /game/:sessionId — subscribes the store to the
// session via useSession, watches the current round, and renders the right
// in-game screen for THIS client's role.
//
// Multi-round flow (Phase 3.2):
//   round.id change → reset `accepted` so RoleReveal runs for the new round
//   round.status='finished' AND host AND more rounds → host calls
//     startNextRound() after a brief result-viewing pause
//   round.status='finished' AND host AND last round → host calls
//     finishSession() → session.status='finished' → everyone navigates to
//     /gallery/:sessionId

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import type { Submission } from '../lib/types';
import RoleRevealScreen from './RoleRevealScreen';
import HiderCaptureScreen from './HiderCaptureScreen';
import HiderWaitScreen from './HiderWaitScreen';
import SeekerHuntScreen from './SeekerHuntScreen';
import VerifyingScreen from './VerifyingScreen';
import ResultScreen from './ResultScreen';

const ROUND_END_PAUSE_MS = 5_000;

export default function GameRouter() {
  const { sessionId = null } = useParams<{ sessionId: string }>();
  useSession(sessionId);

  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const players = useStore((s) => s.players);
  const round = useStore((s) => s.currentRound);
  const authUserId = useStore((s) => s.identity.authUserId);
  const setCurrentSubmissionId = useStore((s) => s.setCurrentSubmissionId);
  const clearSubmissions = useStore((s) => s.clearSubmissions);
  const startNextRound = useStore((s) => s.startNextRound);
  const finishSession = useStore((s) => s.finishSession);

  const [accepted, setAccepted] = useState(false);
  const submissionId = useStore((s) => s.currentSubmissionId);
  const [submission, setSubmission] = useState<Submission | null>(null);

  // New round arrived (host inserted one + sessions.current_round_id flipped).
  // Reset per-round local state so RoleReveal runs again for everyone.
  const lastRoundId = useRef<string | null>(null);
  useEffect(() => {
    if (!round) return;
    if (lastRoundId.current && lastRoundId.current !== round.id) {
      setAccepted(false);
      setSubmission(null);
      setCurrentSubmissionId(null);
      clearSubmissions();
    }
    lastRoundId.current = round.id;
  }, [round?.id, setCurrentSubmissionId, clearSubmissions]);

  // Poll the seeker's own submission for status changes.
  useEffect(() => {
    if (!submissionId) { setSubmission(null); return; }
    let cancelled = false;
    let timer: number | null = null;
    const tick = async () => {
      const { data } = await supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle();
      if (cancelled) return;
      setSubmission(data as Submission | null);
      if (data?.status !== 'verified') {
        timer = window.setTimeout(tick, 400);
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [submissionId]);

  // Host-only: advance the game when a round finishes. After a brief pause
  // (long enough for ResultScreen to register), either start the next round
  // or end the session.
  const isHost = !!session && session.host_id === authUserId;
  const advancedForRoundRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !round || !session) return;
    if (round.status !== 'finished') return;
    if (advancedForRoundRef.current === round.id) return;
    advancedForRoundRef.current = round.id;
    const isLast = round.round_number >= session.settings.rounds_total;
    const t = window.setTimeout(async () => {
      try {
        if (isLast) {
          await finishSession();
        } else {
          await startNextRound();
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('[GameRouter] advance failed', e);
      }
    }, ROUND_END_PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [round?.id, round?.status, round?.round_number, session?.settings.rounds_total, isHost, startNextRound, finishSession, session]);

  // Everyone: when session flips to 'finished', go to gallery.
  useEffect(() => {
    if (session?.status === 'finished' && sessionId) {
      navigate(`/gallery/${sessionId}`);
    }
  }, [session?.status, sessionId, navigate]);

  // Bounce back home if we land here with a mismatched session.
  useEffect(() => {
    if (sessionId && session && session.id !== sessionId) {
      navigate('/');
    }
  }, [sessionId, session, navigate]);

  if (!sessionId || !session || !authUserId) {
    return <Centered text="Loading hunt…" />;
  }
  if (!round) {
    return <Centered text="Waiting for round…" />;
  }

  const isHider = round.hider_id === authUserId;
  const role: 'hider' | 'seeker' = isHider ? 'hider' : 'seeker';
  const hiderName = players.find((p) => p.id === round.hider_id)?.name ?? null;

  // Pre-trap reveal stage
  if (!accepted) {
    return (
      <RoleRevealScreen
        role={role}
        hiderName={hiderName}
        onAccept={() => setAccepted(true)}
      />
    );
  }

  // Hider: capture pre-trap; wait while active; "round over" until host
  // advances (handled inside HiderWaitScreen via round.status check).
  if (isHider) {
    return round.status === 'pending' ? <HiderCaptureScreen /> : <HiderWaitScreen />;
  }

  // Seeker state machine.
  if (submissionId) {
    if (!submission || submission.status === 'pending') {
      return submission?.photo_path || submission === null ? <VerifyingScreen /> : <SeekerHuntScreen />;
    }
    if (submission.status === 'verified') return <ResultScreen />;
  }
  return <SeekerHuntScreen />;
}

function Centered({ text }: { text: string }) {
  return (
    <main className="flex h-full w-full items-center justify-center bg-cream text-ink">
      <div className="font-mono text-xs uppercase tracking-[0.25em] text-ink-soft">{text}</div>
    </main>
  );
}

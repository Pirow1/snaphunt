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
//     /game/:sessionId/winner

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
import RoundResultScreen from './RoundResultScreen';
import EliminatedScreen from './EliminatedScreen';
import { TrapOverlay } from '../components/game/TrapOverlay';

const ROUND_END_PAUSE_MS = 8_000;
// Grace window after round.status flips to 'finished' before swapping to
// RoundResultScreen. Lets the winning seeker actually SEE their personal
// "A Match!" verdict (with arpeggio + haptic) for a beat before the
// unified between-rounds reveal takes over.
const ROUND_RESULT_DELAY_MS = 2_000;

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
  const resetAssists = useStore((s) => s.resetAssists);

  const [accepted, setAccepted] = useState(false);
  const [lives, setLives] = useState(3);
  const [showTrap, setShowTrap] = useState(false);
  const [eliminated, setEliminated] = useState(false);
  const submissionId = useStore((s) => s.currentSubmissionId);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [showRoundResult, setShowRoundResult] = useState(false);

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
      resetAssists();
      setShowTrap(false);
      setLives(3);
      setEliminated(false);
      setShowRoundResult(false);
    }
    lastRoundId.current = round.id;
  }, [round?.id, setCurrentSubmissionId, clearSubmissions, resetAssists]);

  // After round.status flips to 'finished', wait ROUND_RESULT_DELAY_MS before
  // swapping every client over to RoundResultScreen — gives the winning
  // seeker time to see their personal "A Match!" ResultScreen (with audio
  // + haptic) before the unified reveal takes over.
  useEffect(() => {
    if (round?.status !== 'finished') { setShowRoundResult(false); return; }
    const t = window.setTimeout(() => setShowRoundResult(true), ROUND_RESULT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [round?.status, round?.id]);

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
    // NOTE: `session` itself is intentionally NOT in deps — its reference
    // changes on every realtime broadcast, which would cancel the 8s timer
    // mid-flight and the ref guard would then block re-scheduling. We
    // depend on the scalar fields we actually read (rounds_total, host).
  }, [round?.id, round?.status, round?.round_number, session?.settings.rounds_total, isHost, startNextRound, finishSession]);

  // Everyone: when session flips to 'finished', go to the winner-reveal
  // screen (which then routes onward to the gallery on user tap).
  useEffect(() => {
    if (session?.status === 'finished' && sessionId) {
      navigate(`/game/${sessionId}/winner`);
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

  // Round is over for everyone — show the unified reveal (Phase 3.5) after
  // the grace window. During the grace window every client stays on their
  // existing screen so the winning seeker's personal "A Match!" verdict
  // gets visible airtime.
  if (round.status === 'finished' && showRoundResult) {
    return <RoundResultScreen />;
  }

  // Hider: capture pre-trap; wait while active; "round over" until host
  // advances (handled inside HiderWaitScreen via round.status check).
  if (isHider) {
    return round.status === 'pending' ? <HiderCaptureScreen /> : <HiderWaitScreen />;
  }

  if (eliminated) return <EliminatedScreen />;

  // Seeker state machine.
  if (submissionId) {
    if (!submission || submission.status === 'pending') {
      return submission?.photo_path || submission === null ? <VerifyingScreen /> : <SeekerHuntScreen />;
    }
    if (submission.status === 'verified') {
      const isMatch = submission.is_match;
      if (isMatch === false && !showTrap) {
        // Trigger trap — clear submission first so we return to hunting after.
        setCurrentSubmissionId(null);
        setShowTrap(true);
        return <SeekerHuntScreen />;
      }
      return <ResultScreen />;
    }
    if (submission.status === 'error') {
      // Edge function failed (toast already shown from store). Clear the
      // submission and let the seeker re-shoot.
      setCurrentSubmissionId(null);
      return <SeekerHuntScreen />;
    }
  }

  if (showTrap) {
    return (
      <TrapOverlay
        lives={lives}
        onSolve={() => setShowTrap(false)}
        onFail={() => {
          const next = lives - 1;
          setLives(next);
          setShowTrap(false);
          if (next <= 0) setEliminated(true);
        }}
      />
    );
  }

  return <SeekerHuntScreen />;
}

function Centered({ text }: { text: string }) {
  return (
    <main className="flex h-full w-full items-center justify-center bg-forest-dark">
      <div className="font-mono text-xs uppercase tracking-[0.25em] text-parchment/40">{text}</div>
    </main>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { useCountdown } from '../hooks/useCountdown';
import type { Submission } from '../lib/types';
import { playExplosion, playDefused } from '../lib/audio';
import RoleRevealScreen from './RoleRevealScreen';
import PlanterScreen from './PlanterScreen';
import PlanterWaitScreen from './PlanterWaitScreen';
import DefuserHuntScreen from './DefuserHuntScreen';
import ResultScreen from './ResultScreen';
import { DefusalPuzzle } from '../components/game/DefusalPuzzle';

const ROUND_END_PAUSE_MS = 6_000;
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
  const expireRoundNoWinner = useStore((s) => s.expireRoundNoWinner);
  const submissionId = useStore((s) => s.currentSubmissionId);

  const [accepted, setAccepted] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [showDefusal, setShowDefusal] = useState(false);
  const [roundOutcome, setRoundOutcome] = useState<'defused' | 'exploded' | null>(null);
  const [showResult, setShowResult] = useState(false);

  const { isExpired } = useCountdown(round?.expires_at ?? null);
  const isHost = !!session && session.host_id === authUserId;

  // Reset state when round changes
  const lastRoundId = useRef<string | null>(null);
  useEffect(() => {
    if (!round) return;
    if (lastRoundId.current && lastRoundId.current !== round.id) {
      setAccepted(false);
      setSubmission(null);
      setCurrentSubmissionId(null);
      clearSubmissions();
      setShowDefusal(false);
      setRoundOutcome(null);
      setShowResult(false);
    }
    lastRoundId.current = round.id;
  }, [round?.id, setCurrentSubmissionId, clearSubmissions]);

  // Bomb expires — host closes the round
  useEffect(() => {
    if (!isExpired || !round || round.status !== 'active') return;
    if (!isHost) return;
    expireRoundNoWinner().catch(console.error);
  }, [isExpired, round?.status, isHost, expireRoundNoWinner]);

  // Round finished → show result after delay
  useEffect(() => {
    if (round?.status !== 'finished') { setShowResult(false); return; }
    const t = window.setTimeout(() => setShowResult(true), ROUND_RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [round?.status, round?.id]);

  // Host advances after round finishes
  const advancedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost || !round || !session) return;
    if (round.status !== 'finished') return;
    if (advancedRef.current === round.id) return;
    advancedRef.current = round.id;
    const isLast = round.round_number >= session.settings.rounds_total;
    const t = window.setTimeout(async () => {
      try {
        if (isLast) await finishSession();
        else await startNextRound();
      } catch (e) { console.error('[GameRouter] advance failed', e); }
    }, ROUND_END_PAUSE_MS);
    return () => clearTimeout(t);
  }, [round?.id, round?.status, round?.round_number, session?.settings.rounds_total, isHost, startNextRound, finishSession]);

  // Navigate to winner screen when session ends
  useEffect(() => {
    if (session?.status === 'finished' && sessionId) navigate(`/game/${sessionId}/winner`);
  }, [session?.status, sessionId, navigate]);

  // Poll submission status
  useEffect(() => {
    if (!submissionId) { setSubmission(null); return; }
    let cancelled = false;
    let timer: number | null = null;
    const tick = async () => {
      const { data } = await supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle();
      if (cancelled) return;
      setSubmission(data as Submission | null);
      if (data?.status !== 'verified') timer = window.setTimeout(tick, 400);
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [submissionId]);

  // Handle defusal puzzle outcome
  const handleDefused = useCallback(async () => {
    setShowDefusal(false);
    playDefused();
    setRoundOutcome('defused');
    // Claim win via RPC
    if (round) {
      const { error } = await supabase.rpc('rb_claim_round_defused', { p_round_id: round.id });
      if (error) console.error(error);
    }
  }, [round?.id]);

  const handleDefusalFailed = useCallback(() => {
    setShowDefusal(false);
    setCurrentSubmissionId(null);
    setSubmission(null);
  }, [setCurrentSubmissionId]);

  const handleBombExploded = useCallback(() => {
    playExplosion();
    setRoundOutcome('exploded');
  }, []);

  if (!sessionId || !session || !authUserId) {
    return <Centered text="Loading operation…" />;
  }
  if (!round) {
    return <Centered text="Awaiting orders…" />;
  }

  const isPlanter = round.planter_id === authUserId;
  const planterName = players.find((p) => p.id === round.planter_id)?.name ?? null;

  // Role reveal
  if (!accepted) {
    return (
      <RoleRevealScreen
        role={isPlanter ? 'planter' : 'defuser'}
        planterName={planterName}
        onAccept={() => setAccepted(true)}
      />
    );
  }

  // Round outcome result screen
  if (roundOutcome && !showResult) {
    return <ResultScreen outcome={roundOutcome} onContinue={() => setShowResult(true)} />;
  }

  // Planter flow
  if (isPlanter) {
    return round.status === 'pending' ? <PlanterScreen /> : <PlanterWaitScreen />;
  }

  // Defusal puzzle overlay
  if (showDefusal) {
    return <DefusalPuzzle onDefused={handleDefused} onFailed={handleDefusalFailed} />;
  }

  // Defuser: check submission result
  if (submissionId && submission?.status === 'verified') {
    if (submission.is_match === true) {
      // Trigger defusal puzzle
      if (!showDefusal && roundOutcome === null) {
        setShowDefusal(true);
      }
    }
    if (submission.is_match === false) {
      // Wrong location — go back to hunting
      setCurrentSubmissionId(null);
      setSubmission(null);
    }
  }

  return (
    <DefuserHuntScreen
      onBombExploded={handleBombExploded}
    />
  );
}

function Centered({ text }: { text: string }) {
  return (
    <main className="flex h-full w-full items-center justify-center bg-void">
      <div className="font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash animate-blink">{text}</div>
    </main>
  );
}

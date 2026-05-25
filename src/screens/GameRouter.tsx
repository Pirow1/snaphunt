// State-machine screen at /game/:sessionId — subscribes the store to the
// session via useSession, watches the current round, and renders the right
// in-game screen for THIS client's role.
//
// State graph (spec §12, this phase):
//   round.status === 'pending'  → RoleRevealScreen (per role)
//   round.status === 'pending', accepted locally → Capture/Hunt placeholder
//   round.status === 'active' / 'finished' → handled in later phases
//
// The "accepted" flag is per-client local state; it doesn't need to be
// synced because a player's own role progression only affects their own
// view. The round.status flip to 'active' happens when the hider sets the
// trap (Phase 2.2).

import { useEffect, useState } from 'react';
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

export default function GameRouter() {
  const { sessionId = null } = useParams<{ sessionId: string }>();
  useSession(sessionId);

  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const players = useStore((s) => s.players);
  const round = useStore((s) => s.currentRound);
  const authUserId = useStore((s) => s.identity.authUserId);

  const [accepted, setAccepted] = useState(false);
  const submissionId = useStore((s) => s.currentSubmissionId);
  const [submission, setSubmission] = useState<Submission | null>(null);

  // Poll the seeker's own submission for status changes (covers both the
  // local-decision instant flip and the cloud-stub's 4s timer).
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

  // If we somehow land here without an active session (refresh, bad URL),
  // bounce back home so the user can re-join.
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

  // Hider: capture before the trap is set, wait after.
  if (isHider) {
    return round.status === 'pending' ? <HiderCaptureScreen /> : <HiderWaitScreen />;
  }

  // Seeker state machine: no submission yet → hunt; pending submission with
  // photo path (cloud branch) → verifying; verified → result.
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

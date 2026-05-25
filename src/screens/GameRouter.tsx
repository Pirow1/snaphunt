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
import RoleRevealScreen from './RoleRevealScreen';
import HiderCaptureScreen from './HiderCaptureScreen';
import HiderWaitScreen from './HiderWaitScreen';
import SeekerHuntScreen from './SeekerHuntScreen';

export default function GameRouter() {
  const { sessionId = null } = useParams<{ sessionId: string }>();
  useSession(sessionId);

  const navigate = useNavigate();
  const session = useStore((s) => s.session);
  const players = useStore((s) => s.players);
  const round = useStore((s) => s.currentRound);
  const authUserId = useStore((s) => s.identity.authUserId);

  const [accepted, setAccepted] = useState(false);

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

  // Post-accept: route to the role-specific screen. The actual content of
  // these screens is built in Phase 2.2 (hider) and Phase 2.4 (seeker).
  if (isHider) {
    return round.status === 'pending' ? <HiderCaptureScreen /> : <HiderWaitScreen />;
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

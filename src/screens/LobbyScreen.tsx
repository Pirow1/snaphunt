import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useStore } from '../lib/store';
import { useSession } from '../hooks/useSession';
import { useViewTransition } from '../hooks/useViewTransition';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { PlayerRow } from '../components/game/PlayerRow';
import { playJoin, vibrate } from '../lib/audio';

const MAX_PLAYERS = 8;
const MIN_TO_START = 3;

export default function LobbyScreen() {
  const { sessionId = null } = useParams<{ sessionId: string }>();
  useSession(sessionId);
  const go = useViewTransition();

  const session = useStore((s) => s.session);
  const players = useStore((s) => s.players);
  const authUserId = useStore((s) => s.identity.authUserId);
  const startGame = useStore((s) => s.startGame);
  const visionLoadProgress = useStore((s) => s.visionLoadProgress);
  const visionReady = useStore((s) => s.visionReady);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // When the host flips session.status to 'playing', every client (host
  // and guests) sails to the game screen via View Transition.
  useEffect(() => {
    if (session?.status === 'playing' && sessionId) {
      go(`/game/${sessionId}`);
    }
  }, [session?.status, sessionId, go]);

  const isHost = !!session && !!authUserId && session.host_id === authUserId;
  const code = session?.code ?? '';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [recentJoinId, setRecentJoinId] = useState<string | null>(null);
  const prevPlayerIds = useRef<Set<string>>(new Set());

  // QR encodes the deep-link join URL.
  useEffect(() => {
    if (!code || !canvasRef.current) return;
    const url = `${window.location.origin}/join/${code}`;
    QRCode.toCanvas(canvasRef.current, url, { width: 156, margin: 0, color: { dark: '#1A1614', light: '#F4E8D0' } })
      .catch((e) => setQrError(String(e)));
  }, [code]);

  // Track new-player arrivals to apply the gold→cream-2 pulse for 1.2s.
  useEffect(() => {
    const seen = prevPlayerIds.current;
    const fresh = players.find((p) => !seen.has(p.id));
    players.forEach((p) => seen.add(p.id));
    if (fresh) {
      setRecentJoinId(fresh.id);
      playJoin();
      vibrate(30);
      const t = window.setTimeout(() => setRecentJoinId(null), 1200);
      return () => window.clearTimeout(t);
    }
  }, [players]);

  if (!sessionId) return null;

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <TopBar title="Hunt Lobby" back="/" right={<TopBarBadge tone={isHost ? 'gold' : 'dark'}>{isHost ? 'Host' : 'Guest'}</TopBarBadge>} />

      <div className="flex flex-1 flex-col overflow-y-auto px-[22px] pt-5 pb-7">
        <div className="text-center">
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-ink-soft">
            Share this code
          </div>
          <div
            className="my-1.5 font-mono text-[52px] font-bold tracking-[0.15em]"
            data-testid="lobby-code"
          >
            {code || '······'}
          </div>

          <div className="relative mx-auto mt-3 w-fit border-2 border-ink bg-cream p-4 shadow-[6px_6px_0_var(--ink)]">
            <span className="absolute left-1/2 top-[-10px] -translate-x-1/2 bg-blaze px-2.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-cream">
              Scan to Join
            </span>
            {qrError ? (
              <div className="grid h-[156px] w-[156px] place-items-center text-xs text-ink-soft">QR error</div>
            ) : (
              <canvas ref={canvasRef} className="block" aria-label={`QR code for join code ${code}`} />
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em]">Players Joined</span>
            <span className="font-mono text-[11px] font-bold tracking-[0.18em]" data-testid="player-count">
              {players.length} / {MAX_PLAYERS}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {players.length === 0 ? (
              <div className="border-2 border-dashed border-ink/30 bg-cream-2/50 py-4 text-center font-mono text-xs text-ink-soft">
                waiting…
              </div>
            ) : (
              players.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  isSelf={p.id === authUserId}
                  isNew={p.id === recentJoinId}
                />
              ))
            )}
          </div>
        </div>

        {!visionReady && (
          <div className="mt-4 flex items-center gap-2 border-2 border-ink bg-cream-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em]">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-blaze"
            />
            <span>Vision {visionLoadProgress}%</span>
            <div className="ml-auto h-1.5 w-20 overflow-hidden border border-ink bg-cream">
              <div
                className="h-full bg-blaze transition-[width] duration-200"
                style={{ width: `${Math.min(100, visionLoadProgress)}%` }}
              />
            </div>
          </div>
        )}

        {isHost && (
          <div className="mt-auto pt-6">
            <button
              type="button"
              disabled={players.length < MIN_TO_START || starting}
              onClick={async () => {
                setStartError(null);
                setStarting(true);
                try {
                  await startGame();
                  // The useEffect above will navigate everyone once the
                  // session.status='playing' broadcast lands.
                } catch (e) {
                  const msg = e instanceof Error ? e.message : 'Could not start.';
                  setStartError(msg);
                  setStarting(false);
                }
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-[2px] border-2 border-ink bg-blaze px-[22px] py-[18px] font-display text-[17px] font-bold uppercase tracking-tight text-cream shadow-brutal transition-[transform,box-shadow] duration-[80ms] hover:bg-blaze-deep active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="begin-hunt"
            >
              {starting ? 'Starting…' : 'Begin the Hunt →'}
            </button>
            {startError && (
              <p className="mt-3 text-center font-display text-xs font-bold uppercase tracking-[0.15em] text-blaze">{startError}</p>
            )}
            {!startError && players.length < MIN_TO_START && (
              <p className="mt-3 text-center font-mono text-[10px] text-ink-soft">
                Need at least {MIN_TO_START} players to start ({players.length}/{MIN_TO_START})
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useStore } from '../lib/store';
import { useSession } from '../hooks/useSession';
import { useViewTransition } from '../hooks/useViewTransition';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { PlayerRow } from '../components/game/PlayerRow';
import { playJoin, vibrate } from '../lib/audio';
import { ForestBg } from '../components/ui/ForestBg';

const MAX_PLAYERS = 8;
const MIN_TO_START = 2;

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

  useEffect(() => {
    if (!code || !canvasRef.current) return;
    const url = `${window.location.origin}/join/${code}`;
    QRCode.toCanvas(canvasRef.current, url, { width: 156, margin: 0, color: { dark: '#0E1A0A', light: '#F5ECD7' } })
      .catch((e) => setQrError(String(e)));
  }, [code]);

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
    <main className="relative isolate flex h-full w-full flex-col bg-forest-dark text-parchment">
      <ForestBg />
      <TopBar title="Hunt Lobby" back="/" right={<TopBarBadge tone={isHost ? 'gold' : 'dark'}>{isHost ? 'Host' : 'Guest'}</TopBarBadge>} />

      <div className="flex flex-1 flex-col overflow-y-auto px-[22px] pt-5 pb-7">
        <div className="text-center">
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-parchment/75">
            Share this code
          </div>
          <div
            className="my-1.5 font-mono text-[52px] font-bold tracking-[0.12em] text-gold"
            style={{ textShadow: '0 0 20px rgba(200,168,75,0.3)' }}
            data-testid="lobby-code"
          >
            {code || '······'}
          </div>

          <div className="relative mx-auto mt-3 w-fit rounded-[3px] border-2 border-gold/50 bg-parchment p-3.5 shadow-[0_0_0_4px_rgba(200,168,75,0.08)]">
            <span className="absolute left-1/2 top-[-10px] -translate-x-1/2 rounded-[2px] bg-gold px-2.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-[0.2em] text-forest-dark">
              Scan to Join
            </span>
            {qrError ? (
              <div className="grid h-[156px] w-[156px] place-items-center text-xs text-ink/60">QR error</div>
            ) : (
              <canvas ref={canvasRef} className="block" aria-label={`QR code for join code ${code}`} />
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-parchment/75">Players Joined</span>
            <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-gold" data-testid="player-count">
              {players.length} / {MAX_PLAYERS}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {players.length === 0 ? (
              <div className="rounded-[3px] border border-gold/15 bg-forest-mid/40 py-4 text-center font-mono text-xs text-parchment/58">
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
          <div className="mt-4 flex items-center gap-2 rounded-[3px] border border-gold/20 bg-forest-mid/50 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-parchment">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-ember"
            />
            <span>Vision {visionLoadProgress}%</span>
            <div className="ml-auto h-1.5 w-20 overflow-hidden rounded-[2px] border border-gold/30 bg-forest-dark">
              <div
                className="h-full bg-gold transition-[width] duration-200"
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
                } catch (e) {
                  const msg = e instanceof Error ? e.message : 'Could not start.';
                  setStartError(msg);
                  setStarting(false);
                }
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-[3px] border-[1.5px] border-gold bg-gold px-[22px] py-[17px] font-display text-[15px] font-extrabold uppercase tracking-[0.06em] text-forest-dark backdrop-blur-sm transition-transform duration-[80ms] active:scale-[0.98] hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
              data-testid="begin-hunt"
            >
              {starting ? 'Starting…' : 'Begin the Hunt →'}
            </button>
            {startError && (
              <p className="mt-3 text-center font-display text-xs font-bold uppercase tracking-[0.15em] text-ember">{startError}</p>
            )}
            {!startError && players.length < MIN_TO_START && (
              <p className="mt-3 text-center font-mono text-[10px] text-parchment/65">
                Need at least {MIN_TO_START} players to start ({players.length}/{MIN_TO_START})
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

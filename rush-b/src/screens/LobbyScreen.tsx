import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';

export default function LobbyScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  useSession(sessionId ?? null);
  const navigate = useNavigate();

  const session = useStore((s) => s.session);
  const players = useStore((s) => s.players);
  const authUserId = useStore((s) => s.identity.authUserId);
  const startGame = useStore((s) => s.startGame);

  const isHost = session?.host_id === authUserId;
  const canStart = players.length >= 2;

  async function handleStart() {
    try {
      await startGame();
      navigate(`/game/${sessionId}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start');
    }
  }

  if (!session) {
    return (
      <main className="flex h-full w-full items-center justify-center bg-void">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash">Loading…</div>
      </main>
    );
  }

  return (
    <main className="flex h-full w-full flex-col bg-void text-smoke">
      <TopBar
        title="Staging Area"
        right={<TopBarBadge tone={isHost ? 'yellow' : 'red'}>{isHost ? 'Host' : 'Operative'}</TopBarBadge>}
      />

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
        {/* Operation code */}
        <div className="rounded-[2px] border-2 border-spark bg-spark/5 p-4 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-1">Operation Code</div>
          <div className="font-mono text-[36px] tracking-[0.5em] text-spark">{session.code}</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-ash/60 mt-1">
            Share with your team
          </div>
        </div>

        {/* Player list */}
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-2">
            Operatives ({players.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-[2px] border border-rim bg-surface px-3 py-2.5"
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="flex-1 font-sans text-[15px] font-semibold text-smoke">{p.name}</span>
                {p.id === session.host_id && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-spark border border-spark/40 px-1.5 py-0.5 rounded-[2px]">
                    Host
                  </span>
                )}
                {p.id === authUserId && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ash">You</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {!canStart && isHost && (
          <div className="rounded-[2px] border border-rim bg-surface px-3 py-2 font-mono text-[11px] text-ash text-center">
            Waiting for at least 2 operatives…
          </div>
        )}

        <div className="mt-auto">
          {isHost ? (
            <Button variant="primary" disabled={!canStart} onClick={handleStart}>
              ▶ INITIATE OPERATION
            </Button>
          ) : (
            <div className="rounded-[2px] border border-rim bg-surface px-3 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ash text-center animate-blink">
              Awaiting host…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

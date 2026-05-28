import { useStore } from '../lib/store';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { BombTimer } from '../components/game/BombTimer';

export default function PlanterWaitScreen() {
  const round = useStore((s) => s.currentRound);

  return (
    <main className="flex h-full w-full flex-col bg-void text-smoke">
      <TopBar title="Bomb Planted" right={<TopBarBadge tone="red">Planter</TopBarBadge>} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
        <BombTimer expiresAt={round?.expires_at ?? null} />

        <div className="w-full rounded-[2px] border border-rim bg-surface px-4 py-4 text-center">
          <div className="font-display text-[48px] leading-none">💣</div>
          <div className="mt-2 font-display text-[22px] tracking-[0.06em] text-threat">BOMB IS LIVE</div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ash">
            Defusers are hunting your location
          </div>
        </div>

        <div className="w-full rounded-[2px] border border-rim bg-surface px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash mb-2">Bomb Position</div>
          {round?.planter_lat != null ? (
            <div className="font-mono text-[12px] text-smoke">
              {round.planter_lat.toFixed(5)}, {round.planter_lng!.toFixed(5)}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-ash">Pinned</div>
          )}
        </div>
      </div>
    </main>
  );
}

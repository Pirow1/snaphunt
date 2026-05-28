import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';

export default function WinnerRevealScreen() {
  const navigate = useNavigate();
  const players = useStore((s) => s.players);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <main className="flex h-full w-full flex-col bg-void text-smoke">
      <div className="warning-stripe h-[8px] w-full" />

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
        <div className="text-center">
          <div className="font-rb-mono text-[10px] uppercase tracking-[0.35em] text-ash mb-2">Operation Complete</div>
          <div className="font-rb-display text-[64px] leading-none text-spark">{winner?.emoji ?? '🎖️'}</div>
          <div className="font-rb-display text-[40px] tracking-[0.06em] text-chalk mt-1">{winner?.name ?? '—'}</div>
          <div className="font-rb-display text-[28px] text-spark mt-1">{winner?.score ?? 0} pts</div>
        </div>

        <div className="w-full">
          <div className="font-rb-mono text-[10px] uppercase tracking-[0.2em] text-ash mb-2">Full Debrief</div>
          <div className="flex flex-col gap-1.5">
            {sorted.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-[2px] border border-rim bg-surface px-3 py-2.5">
                <span className="font-rb-mono text-[14px] text-ash w-5">{i + 1}</span>
                <span className="text-xl">{p.emoji}</span>
                <span className="flex-1 font-rb-sans text-[15px] font-semibold">{p.name}</span>
                <span className="font-rb-display text-[18px] text-spark">{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" onClick={() => navigate('/')}>
          ↩ Back to Base
        </Button>
      </div>

      <div className="warning-stripe h-[8px] w-full" />
    </main>
  );
}

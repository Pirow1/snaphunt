import { useViewTransition } from '../hooks/useViewTransition';
import { Button } from '../components/ui/Button';

type Props = { onBack?: () => void };

export default function HomeScreen({ onBack }: Props) {
  const go = useViewTransition();

  return (
    <main className="relative flex h-full w-full flex-col bg-void">
      {/* Scanline handled by globals.css #app::before */}

      {/* Top warning stripe */}
      <div className="warning-stripe h-[10px] w-full" />

      {/* Back to dashboard */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-3 z-10 font-rb-mono text-[10px] uppercase tracking-[0.2em] text-ash/60 active:text-ash"
          style={{ lineHeight: '10px' }}
        >
          ← Hub
        </button>
      )}

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        {/* Classification stamp */}
        <div className="mb-6 inline-block border-2 border-threat px-4 py-1 font-rb-mono text-[10px] uppercase tracking-[0.35em] text-threat">
          ⚠ Classified Operation
        </div>

        {/* Main title */}
        <div className="font-rb-display text-[90px] leading-[0.85] tracking-[0.02em] text-chalk">
          RUSH
        </div>
        <div className="font-rb-display text-[90px] leading-[0.85] tracking-[0.02em] text-spark">
          B
        </div>

        <div className="mt-4 font-rb-mono text-[12px] uppercase tracking-[0.3em] text-ash">
          Plant it. Find it. Defuse it.
        </div>

        {/* Stats row */}
        <div className="mt-8 flex gap-8 border-y border-rim py-4">
          {[['ROUNDS', '3'], ['TIMER', '3–15'], ['DEFUSE', 'PUZZLE']].map(([label, val]) => (
            <div key={label} className="text-center">
              <div className="font-rb-display text-[26px] text-spark">{val}</div>
              <div className="font-rb-mono text-[9px] uppercase tracking-[0.2em] text-ash">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-6 pb-8 flex flex-col gap-3">
        <Button variant="primary" onClick={() => go('/create')}>
          ▶ Plant Operation
        </Button>
        <Button variant="outline" onClick={() => go('/join')}>
          ⬡ Join as Defuser
        </Button>
      </div>

      {/* Bottom warning stripe */}
      <div className="warning-stripe h-[10px] w-full" />
    </main>
  );
}

import { useState } from 'react';
import { TrapOverlay } from '../components/game/TrapOverlay';

export default function TrapTestScreen() {
  const [lives, setLives] = useState(3);
  const [key, setKey] = useState(0); // remount overlay to get a fresh puzzle
  const [showOverlay, setShowOverlay] = useState(false);
  const [lastResult, setLastResult] = useState<'solved' | 'failed' | null>(null);
  const [eliminated, setEliminated] = useState(false);

  function triggerTrap() {
    setShowOverlay(true);
    setLastResult(null);
  }

  function handleSolve() {
    setShowOverlay(false);
    setLastResult('solved');
    setKey((k) => k + 1);
  }

  function handleFail() {
    const next = lives - 1;
    setLives(next);
    setShowOverlay(false);
    setLastResult('failed');
    setKey((k) => k + 1);
    if (next <= 0) setEliminated(true);
  }

  function reset() {
    setLives(3);
    setEliminated(false);
    setLastResult(null);
    setKey((k) => k + 1);
  }

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-forest-dark px-6">
      <div className="text-center">
        <h1 className="font-display text-[22px] font-extrabold uppercase tracking-[0.12em] text-gold">
          Trap Test Harness
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-parchment/30">
          DEV ONLY
        </p>
      </div>

      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`text-[24px] transition-all ${i < lives ? '' : 'opacity-20 grayscale'}`}>
            ❤️
          </span>
        ))}
        <span className="ml-2 font-mono text-[13px] text-parchment/50">{lives} lives</span>
      </div>

      {lastResult && (
        <div className={`font-display text-[13px] font-extrabold uppercase tracking-[0.12em] ${lastResult === 'solved' ? 'text-[#22C55E]' : 'text-ember'}`}>
          {lastResult === 'solved' ? '✓ Trap escaped' : `✗ Life lost — ${lives} remaining`}
        </div>
      )}

      {eliminated && (
        <div className="rounded-[3px] border border-ember/40 bg-ember/10 px-4 py-2">
          <p className="font-display text-[13px] font-extrabold uppercase tracking-[0.12em] text-ember">
            Eliminated!
          </p>
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={triggerTrap}
          disabled={showOverlay || eliminated}
          className="rounded-[3px] border-[1.5px] border-ember bg-ember/10 py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.08em] text-ember disabled:opacity-30"
        >
          ⚠ Trigger Trap
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-[3px] border-[1.5px] border-gold/35 bg-forest-mid/50 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.08em] text-parchment/60"
        >
          Reset
        </button>
      </div>

      {showOverlay && (
        <TrapOverlay key={key} lives={lives} onSolve={handleSolve} onFail={handleFail} />
      )}
    </main>
  );
}

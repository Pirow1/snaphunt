import { useState } from 'react';
import type { TrueFalsePuzzle } from '../../../lib/puzzles';

type Props = { puzzle: TrueFalsePuzzle; onSolve: () => void; onFail: () => void };

export function TrueFalsePuzzle({ puzzle, onSolve, onFail }: Props) {
  const [picked, setPicked] = useState<boolean | null>(null);

  function handle(val: boolean) {
    if (picked !== null) return;
    setPicked(val);
    if (val === puzzle.answer) setTimeout(onSolve, 700);
    else setTimeout(onFail, 700);
  }

  function btnClass(val: boolean) {
    if (picked === null) {
      return 'border-gold/35 bg-forest-mid/50 text-parchment active:bg-gold/15';
    }
    if (val === puzzle.answer) return 'border-[#22C55E] bg-[#22C55E]/20 text-[#22C55E]';
    if (val === picked)        return 'border-ember/60 bg-ember/20 text-ember';
    return 'border-gold/20 bg-forest-mid/30 text-parchment/40';
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-center font-serif text-[17px] italic leading-snug text-parchment">
        &ldquo;{puzzle.statement}&rdquo;
      </p>
      <div className="grid w-full grid-cols-2 gap-3">
        {([true, false] as const).map((val) => (
          <button
            key={String(val)}
            type="button"
            onClick={() => handle(val)}
            disabled={picked !== null}
            className={`rounded-[3px] border-[1.5px] py-4 font-display text-[18px] font-extrabold uppercase tracking-[0.08em] transition-colors duration-100 ${btnClass(val)}`}
          >
            {val ? '✓ True' : '✗ False'}
          </button>
        ))}
      </div>
    </div>
  );
}

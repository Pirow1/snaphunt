import { useState } from 'react';
import type { OddOneOutPuzzle } from '../../../lib/puzzles';

type Props = { puzzle: OddOneOutPuzzle; onSolve: () => void; onFail: () => void };

export function OddOneOutPuzzle({ puzzle, onSolve, onFail }: Props) {
  const [picked, setPicked] = useState<number | null>(null);

  function handle(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    if (idx === puzzle.oddIdx) setTimeout(onSolve, 600);
    else setTimeout(onFail, 600);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-[14px] font-bold uppercase tracking-[0.15em] text-parchment/70">
        Tap the odd one out
      </p>
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {puzzle.items.map((emoji, i) => {
          let cls = 'border-gold/25 bg-forest-mid/50 active:bg-gold/15';
          if (picked !== null) {
            if (i === puzzle.oddIdx)    cls = 'border-[#22C55E]/60 bg-[#22C55E]/20';
            else if (i === picked)      cls = 'border-ember/60 bg-ember/20';
            else                        cls = 'border-gold/15 bg-forest-mid/30 opacity-50';
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handle(i)}
              disabled={picked !== null}
              className={`aspect-square rounded-[3px] border-[1.5px] text-3xl transition-colors duration-100 ${cls}`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}

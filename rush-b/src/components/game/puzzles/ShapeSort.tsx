import { useState } from 'react';
import type { ShapeSortPuzzle } from '../../../lib/puzzles';

type Props = { puzzle: ShapeSortPuzzle; onSolve: () => void; onFail: () => void };

export function ShapeSortPuzzle({ puzzle, onSolve, onFail }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);

  function toggle(idx: number) {
    if (done) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function submit() {
    if (done) return;
    setDone(true);
    const targetSet = new Set(puzzle.targetIndices);
    const correct =
      selected.size === targetSet.size &&
      [...selected].every((i) => targetSet.has(i));
    if (correct) setTimeout(onSolve, 600);
    else setTimeout(onFail, 600);
  }

  const targetSet = new Set(puzzle.targetIndices);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-[16px] font-bold uppercase tracking-[0.1em] text-parchment">
        {puzzle.prompt}
      </p>
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {puzzle.items.map((emoji, i) => {
          let cls = 'border-gold/25 bg-forest-mid/50';
          if (selected.has(i)) cls = 'border-gold bg-gold/25';
          if (done) {
            if (targetSet.has(i) && selected.has(i))  cls = 'border-[#22C55E]/60 bg-[#22C55E]/20';
            else if (targetSet.has(i))                 cls = 'border-[#22C55E]/40 bg-[#22C55E]/10 opacity-70';
            else if (selected.has(i))                  cls = 'border-ember/60 bg-ember/20';
            else                                        cls = 'border-gold/15 bg-forest-mid/30 opacity-50';
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={done}
              className={`aspect-square rounded-[3px] border-[1.5px] text-3xl transition-colors duration-100 ${cls}`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      {!done && (
        <button
          type="button"
          onClick={submit}
          disabled={selected.size === 0}
          className="w-full rounded-[3px] border-[1.5px] border-gold bg-gold py-3 font-display text-[14px] font-extrabold uppercase tracking-[0.08em] text-forest-dark disabled:opacity-40"
        >
          Confirm Selection
        </button>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { SimonPuzzle } from '../../../lib/puzzles';

type Colour = 'red' | 'blue' | 'green' | 'gold';
type Props = { puzzle: SimonPuzzle; onSolve: () => void; onFail: () => void };

const BG: Record<Colour, string> = {
  red:   'bg-[#E84040]',
  blue:  'bg-[#3B82F6]',
  green: 'bg-[#22C55E]',
  gold:  'bg-gold',
};
const DIM: Record<Colour, string> = {
  red:   'bg-[#E84040]/25',
  blue:  'bg-[#3B82F6]/25',
  green: 'bg-[#22C55E]/25',
  gold:  'bg-gold/25',
};
const LABELS: Record<Colour, string> = { red: '🔴', blue: '🔵', green: '🟢', gold: '🟡' };

export function SimonSaysPuzzle({ puzzle, onSolve, onFail }: Props) {
  const [phase, setPhase] = useState<'showing' | 'input'>('showing');
  const [lit, setLit] = useState<Colour | null>(null);
  const [inputIdx, setInputIdx] = useState(0);
  const [flash, setFlash] = useState<Colour | null>(null);
  const doneRef = useRef(false);

  // Play back the sequence with 600ms per colour.
  useEffect(() => {
    let cancelled = false;
    const seq = puzzle.sequence;

    async function playback() {
      for (let i = 0; i < seq.length; i++) {
        if (cancelled) return;
        await delay(200);
        if (cancelled) return;
        setLit(seq[i]);
        await delay(550);
        if (cancelled) return;
        setLit(null);
      }
      await delay(300);
      if (!cancelled) setPhase('input');
    }

    playback();
    return () => { cancelled = true; };
  }, [puzzle.sequence]);

  function handleTap(colour: Colour) {
    if (phase !== 'input' || doneRef.current) return;
    setFlash(colour);
    setTimeout(() => setFlash(null), 200);

    if (colour !== puzzle.sequence[inputIdx]) {
      doneRef.current = true;
      setTimeout(onFail, 500);
      return;
    }
    const next = inputIdx + 1;
    if (next === puzzle.sequence.length) {
      doneRef.current = true;
      setTimeout(onSolve, 400);
    } else {
      setInputIdx(next);
    }
  }

  const colours: Colour[] = ['red', 'blue', 'green', 'gold'];

  return (
    <div className="flex flex-col items-center gap-5">
      {phase === 'showing' ? (
        <p className="font-display text-[14px] font-bold uppercase tracking-[0.15em] text-parchment/60">
          Watch the sequence…
        </p>
      ) : (
        <p className="font-display text-[14px] font-bold uppercase tracking-[0.15em] text-gold">
          Repeat it! ({inputIdx + 1}/{puzzle.sequence.length})
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 w-full">
        {colours.map((c) => {
          const active = lit === c || flash === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => handleTap(c)}
              disabled={phase === 'showing'}
              className={[
                'aspect-square rounded-[4px] border-2 border-transparent text-3xl transition-all duration-100',
                active ? BG[c] + ' scale-105 border-white/30' : DIM[c],
                phase === 'input' ? 'active:scale-95' : '',
              ].join(' ')}
            >
              {LABELS[c]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

import { useEffect, useMemo, useState } from 'react';
import type { MemoryPuzzle } from '../../../lib/puzzles';

type Props = { puzzle: MemoryPuzzle; onSolve: () => void; onFail: () => void };

type CardState = 'hidden' | 'flipped' | 'matched';

export function MemoryCardsPuzzle({ puzzle, onSolve, onFail }: Props) {
  // Build 6-card deck: each pair emoji appears twice, shuffled.
  const deck = useMemo(() => {
    const cards = [...puzzle.pairs, ...puzzle.pairs];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }, [puzzle.pairs]);

  const [states, setStates] = useState<CardState[]>(() => Array(6).fill('hidden'));
  const [flippedIdx, setFlippedIdx] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [mistakes, setMistakes] = useState(0);

  const matchedCount = states.filter((s) => s === 'matched').length;

  useEffect(() => {
    if (matchedCount === 6) setTimeout(onSolve, 500);
  }, [matchedCount, onSolve]);

  // 3 mistakes = fail (lenient since there's already a 30s timer)
  useEffect(() => {
    if (mistakes >= 3) setTimeout(onFail, 500);
  }, [mistakes, onFail]);

  function flip(idx: number) {
    if (locked || states[idx] !== 'hidden') return;

    const newStates = [...states];
    newStates[idx] = 'flipped';
    setStates(newStates);

    if (flippedIdx === null) {
      setFlippedIdx(idx);
      return;
    }

    // Second card flipped — check match.
    setLocked(true);
    if (deck[idx] === deck[flippedIdx]) {
      setTimeout(() => {
        setStates((s) => s.map((v, i) => (i === idx || i === flippedIdx ? 'matched' : v)));
        setFlippedIdx(null);
        setLocked(false);
      }, 500);
    } else {
      setMistakes((m) => m + 1);
      setTimeout(() => {
        setStates((s) => s.map((v, i) => (i === idx || i === flippedIdx ? 'hidden' : v)));
        setFlippedIdx(null);
        setLocked(false);
      }, 800);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-[13px] font-bold uppercase tracking-[0.15em] text-parchment/60">
        Match all pairs · {mistakes}/3 mistakes
      </p>
      <div className="grid grid-cols-3 gap-3 w-full">
        {deck.map((emoji, i) => {
          const state = states[i];
          const visible = state === 'flipped' || state === 'matched';
          return (
            <button
              key={i}
              type="button"
              onClick={() => flip(i)}
              className={[
                'aspect-square rounded-[3px] border-[1.5px] text-4xl transition-all duration-200',
                state === 'matched'
                  ? 'border-[#22C55E]/50 bg-[#22C55E]/15'
                  : visible
                    ? 'border-gold/50 bg-forest-mid/70'
                    : 'border-gold/25 bg-forest-mid/50 active:bg-gold/15',
              ].join(' ')}
            >
              {visible ? emoji : '?'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Puzzle } from '../../lib/puzzles';
import { randomPuzzle } from '../../lib/puzzles';
import { MultiChoicePuzzle } from './puzzles/MultiChoice';
import { TrueFalsePuzzle } from './puzzles/TrueFalse';
import { MemoryCardsPuzzle } from './puzzles/MemoryCards';
import { OddOneOutPuzzle } from './puzzles/OddOneOut';
import { ShapeSortPuzzle } from './puzzles/ShapeSort';
import { SimonSaysPuzzle } from './puzzles/SimonSays';

const TRAP_DURATION = 30;

type Phase = 'active' | 'solved' | 'failed';

type Props = {
  lives: number;       // remaining lives BEFORE this attempt
  onSolve: () => void; // puzzle beaten → no life lost
  onFail: () => void;  // wrong answer or timeout → life lost (caller decrements)
};

export function TrapOverlay({ lives, onSolve, onFail }: Props) {
  const [puzzle] = useState<Puzzle>(() => randomPuzzle());
  const [secondsLeft, setSecondsLeft] = useState(TRAP_DURATION);
  const [phase, setPhase] = useState<Phase>('active');
  const resolvedRef = useRef(false);

  // Countdown timer.
  useEffect(() => {
    if (phase !== 'active') return;
    if (secondsLeft <= 0) {
      if (!resolvedRef.current) {
        resolvedRef.current = true;
        setPhase('failed');
        setTimeout(onFail, 900);
      }
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, phase, onFail]);

  function handleSolve() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setPhase('solved');
    setTimeout(onSolve, 900);
  }

  function handleFail() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setPhase('failed');
    setTimeout(onFail, 900);
  }

  const circumference = 2 * Math.PI * 26; // r=26
  const progress = secondsLeft / TRAP_DURATION;
  const dashOffset = circumference * (1 - progress);
  const timerColour =
    secondsLeft > 15 ? '#C8A84B' : secondsLeft > 7 ? '#F97316' : '#C84A1A';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(6,10,4,0.97)] backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gold/[0.18] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-ember">
            ⚠ TRAPPED
          </span>
        </div>
        {/* Lives */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`text-[18px] transition-all duration-300 ${i < lives ? 'opacity-100' : 'opacity-20 grayscale'}`}
            >
              ❤️
            </span>
          ))}
        </div>
      </div>

      {/* Trap caption */}
      <div className="px-5 pt-4 pb-2 text-center">
        <p className="font-serif text-[13px] italic text-parchment/50">
          Solve the puzzle to escape the trap
        </p>
      </div>

      {/* Puzzle area */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {phase === 'active' && <PuzzleHost puzzle={puzzle} onSolve={handleSolve} onFail={handleFail} />}
        {phase === 'solved' && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <span className="text-5xl">🗝️</span>
            <p className="font-display text-[15px] font-extrabold uppercase tracking-[0.1em] text-[#22C55E]">
              Trap escaped!
            </p>
          </div>
        )}
        {phase === 'failed' && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <span className="text-5xl">💀</span>
            <p className="font-display text-[15px] font-extrabold uppercase tracking-[0.1em] text-ember">
              {secondsLeft <= 0 ? "Time's up!" : 'Wrong answer!'}
            </p>
            <p className="font-display text-[12px] uppercase tracking-[0.12em] text-parchment/40">
              {lives - 1 > 0 ? `${lives - 1} ${lives - 1 === 1 ? 'life' : 'lives'} remaining` : 'Eliminated!'}
            </p>
          </div>
        )}
      </div>

      {/* Countdown ring */}
      <div className="flex items-center justify-center border-t border-gold/[0.12] py-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(200,168,75,0.12)" strokeWidth="4" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={timerColour}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
            />
          </svg>
          <span className="font-mono text-[20px] font-bold" style={{ color: timerColour }}>
            {secondsLeft}
          </span>
        </div>
      </div>
    </div>
  );
}

function PuzzleHost({ puzzle, onSolve, onFail }: { puzzle: Puzzle; onSolve: () => void; onFail: () => void }) {
  switch (puzzle.kind) {
    case 'mc':     return <MultiChoicePuzzle puzzle={puzzle} onSolve={onSolve} onFail={onFail} />;
    case 'tf':     return <TrueFalsePuzzle puzzle={puzzle} onSolve={onSolve} onFail={onFail} />;
    case 'memory': return <MemoryCardsPuzzle puzzle={puzzle} onSolve={onSolve} onFail={onFail} />;
    case 'odd':    return <OddOneOutPuzzle puzzle={puzzle} onSolve={onSolve} onFail={onFail} />;
    case 'shape':  return <ShapeSortPuzzle puzzle={puzzle} onSolve={onSolve} onFail={onFail} />;
    case 'simon':  return <SimonSaysPuzzle puzzle={puzzle} onSolve={onSolve} onFail={onFail} />;
    default: {
      const _exhaustive: never = puzzle;
      return _exhaustive;
    }
  }
}

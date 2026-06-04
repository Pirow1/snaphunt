import { useEffect, useRef, useState } from 'react';
import type { MCPuzzle } from '../../../lib/puzzles';

type Props = {
  puzzle: MCPuzzle;
  onSolve: () => void;
  onFail: () => void;
};

// Handles: quick_math, number_sequence, trivia, word_scramble,
// color_name, and count_items (flash visual phase then ask).
export function MultiChoicePuzzle({ puzzle, onSolve, onFail }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  // For flash-type visuals: show the emoji for 1.5s then hide and ask.
  const [showFlash, setShowFlash] = useState(puzzle.visual?.type === 'flash');
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (puzzle.visual?.type === 'flash') {
      flashTimeoutRef.current = setTimeout(() => setShowFlash(false), 1500);
    }
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [puzzle.visual?.type]);

  function handlePick(opt: string) {
    if (revealed || showFlash) return;
    setSelected(opt);
    setRevealed(true);
    if (opt === puzzle.answer) {
      setTimeout(onSolve, 700);
    } else {
      setTimeout(onFail, 700);
    }
  }

  const colors: Record<string, string> = {
    correct: 'border-[#22C55E] bg-[#22C55E]/20 text-[#22C55E]',
    wrong:   'border-ember/60 bg-ember/20 text-ember',
    default: 'border-gold/35 bg-forest-mid/50 text-parchment active:bg-gold/15',
  };

  // Narrow the visual union once so .count/.emoji are safe inside callbacks.
  const flashVisual = puzzle.visual?.type === 'flash' ? puzzle.visual : null;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Flash phase: display emoji grid */}
      {flashVisual && showFlash && (
        <div className="flex flex-wrap justify-center gap-2 rounded-[4px] border border-gold/20 bg-forest-mid/60 p-4">
          {Array.from({ length: flashVisual.count }, (_, i) => (
            <span key={i} className="text-3xl">{flashVisual.emoji}</span>
          ))}
        </div>
      )}

      {/* Color swatch */}
      {puzzle.visual?.type === 'color' && (
        <div
          className="h-16 w-36 rounded-[4px] border-2 border-gold/30"
          style={{ backgroundColor: puzzle.visual.hex }}
        />
      )}

      {/* Question — hidden during flash phase */}
      {(!showFlash) && (
        <p className="text-center font-display text-[18px] font-bold uppercase tracking-[-0.02em] text-parchment">
          {puzzle.prompt}
        </p>
      )}

      {/* Options — hidden during flash phase */}
      {!showFlash && (
        <div className="grid w-full grid-cols-2 gap-2.5">
          {puzzle.options.map((opt) => {
            let cls = colors.default;
            if (revealed) {
              if (opt === puzzle.answer)       cls = colors.correct;
              else if (opt === selected)        cls = colors.wrong;
              else                              cls = 'border-gold/20 bg-forest-mid/30 text-parchment/40';
            }
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handlePick(opt)}
                disabled={revealed}
                className={`rounded-[3px] border-[1.5px] py-3.5 font-display text-[15px] font-bold tracking-wide transition-colors duration-100 ${cls}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {showFlash && (
        <p className="font-serif text-[13px] italic text-parchment/50">
          Memorise — you&apos;ll be asked in a moment…
        </p>
      )}
    </div>
  );
}

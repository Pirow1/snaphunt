import { useState } from 'react';
import { randomPuzzle } from '../../lib/puzzles';
import { MultiChoicePuzzle } from './puzzles/MultiChoice';
import { TrueFalsePuzzle } from './puzzles/TrueFalse';
import { SimonSaysPuzzle } from './puzzles/SimonSays';
import { MemoryCardsPuzzle } from './puzzles/MemoryCards';
import { OddOneOutPuzzle } from './puzzles/OddOneOut';
import { ShapeSortPuzzle } from './puzzles/ShapeSort';

type Props = {
  onDefused: () => void;
  onFailed: () => void;
};

export function DefusalPuzzle({ onDefused, onFailed }: Props) {
  const [puzzle] = useState(() => randomPuzzle());
  const [solved, setSolved] = useState(false);
  const [failed, setFailed] = useState(false);

  function handleSolve() { setSolved(true); setTimeout(onDefused, 600); }
  function handleFail()  { setFailed(true); setTimeout(onFailed, 800); }

  const overlay = solved
    ? 'bg-clear/10 border-clear'
    : failed
    ? 'bg-threat/10 border-threat'
    : 'border-rim';

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-void`}>
      {/* Header */}
      <div className="warning-stripe h-[8px] w-full" />
      <div className="border-b-2 border-rim bg-carbon px-5 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">Defusal Sequence</div>
        <div className="font-display text-[22px] tracking-[0.05em] text-threat">SOLVE TO DEFUSE</div>
      </div>

      <div className={`flex flex-1 flex-col border-2 ${overlay} m-4 rounded-[2px] overflow-hidden transition-colors duration-300`}>
        {solved && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
            <div className="font-display text-[60px] text-clear animate-stamp-in">✓</div>
            <div className="font-display text-[28px] tracking-[0.1em] text-clear">DEFUSED</div>
          </div>
        )}
        {failed && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
            <div className="font-display text-[60px] text-threat">✗</div>
            <div className="font-display text-[22px] tracking-[0.1em] text-threat">FAILED — RETRY</div>
          </div>
        )}
        {!solved && !failed && (
          <div className="flex flex-1 flex-col p-4 overflow-y-auto">
            {puzzle.kind === 'mc'     && <MultiChoicePuzzle puzzle={puzzle} onSolve={handleSolve} onFail={handleFail} />}
            {puzzle.kind === 'tf'     && <TrueFalsePuzzle   puzzle={puzzle} onSolve={handleSolve} onFail={handleFail} />}
            {puzzle.kind === 'simon'  && <SimonSaysPuzzle   puzzle={puzzle} onSolve={handleSolve} onFail={handleFail} />}
            {puzzle.kind === 'memory' && <MemoryCardsPuzzle puzzle={puzzle} onSolve={handleSolve} onFail={handleFail} />}
            {puzzle.kind === 'odd'    && <OddOneOutPuzzle   puzzle={puzzle} onSolve={handleSolve} onFail={handleFail} />}
            {puzzle.kind === 'shape'  && <ShapeSortPuzzle   puzzle={puzzle} onSolve={handleSolve} onFail={handleFail} />}
          </div>
        )}
      </div>

      <div className="warning-stripe h-[8px] w-full" />
    </div>
  );
}

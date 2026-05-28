type Props = { outcome: 'defused' | 'exploded'; onContinue: () => void };

export default function ResultScreen({ outcome, onContinue }: Props) {
  const defused = outcome === 'defused';

  return (
    <main
      className={`flex h-full w-full flex-col items-center justify-center px-6 text-center gap-6 ${defused ? 'bg-void' : 'bg-void'}`}
      onClick={onContinue}
    >
      <div className="warning-stripe h-[8px] w-full absolute top-0 left-0" />

      <div className={`font-rb-display text-[90px] leading-none ${defused ? 'text-clear' : 'text-threat'}`}>
        {defused ? '✓' : '💥'}
      </div>

      <div>
        <div className={`font-rb-display text-[52px] tracking-[0.06em] ${defused ? 'text-clear' : 'text-threat'}`}>
          {defused ? 'DEFUSED' : 'DETONATED'}
        </div>
        <div className="mt-2 font-rb-mono text-[12px] uppercase tracking-[0.2em] text-ash">
          {defused ? 'Bomb successfully neutralised.' : 'The bomb has detonated. Planter wins.'}
        </div>
      </div>

      <div className="font-rb-mono text-[10px] uppercase tracking-[0.15em] text-ash/60 animate-blink">
        Tap to continue
      </div>

      <div className="warning-stripe h-[8px] w-full absolute bottom-0 left-0" />
    </main>
  );
}

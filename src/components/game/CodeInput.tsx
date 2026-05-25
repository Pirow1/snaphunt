// 6-slot uppercase code display + on-screen keypad. Matches snaphunt.html
// .code-input-grid and .keypad exactly.
//
// The on-screen keypad replaces the native keyboard so the typing experience
// matches the brutal-shadow / monospace aesthetic.

type CodeInputProps = {
  value: string;
  onChange: (next: string) => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', '0', 'DEL'] as const;

export function CodeInput({ value, onChange }: CodeInputProps) {
  const slots = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const cursorAt = value.length;

  function press(k: string) {
    if (k === 'DEL') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= 6) return;
    onChange((value + k).toUpperCase());
  }

  return (
    <>
      <div className="my-7 grid grid-cols-6 gap-2">
        {slots.map((ch, i) => {
          const isCursor = i === cursorAt && value.length < 6;
          const filled = !!ch;
          return (
            <div
              key={i}
              className={[
                'relative flex aspect-[0.85] items-center justify-center border-2 border-ink',
                'font-mono text-[28px] font-bold uppercase',
                filled ? 'bg-gold' : 'bg-cream',
              ].join(' ')}
            >
              {ch}
              {isCursor && (
                <span
                  aria-hidden="true"
                  className="absolute h-1/2 w-[2px] animate-blink bg-ink"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 border-2 border-ink bg-cream-2 p-3.5">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="flex aspect-[1.5] items-center justify-center border-2 border-ink bg-cream font-mono text-[22px] font-bold transition-[transform,box-shadow,background] duration-[80ms] active:translate-x-[1px] active:translate-y-[1px] active:bg-gold active:shadow-[1px_1px_0_var(--ink)]"
            aria-label={k === 'DEL' ? 'Backspace' : `Key ${k}`}
          >
            {k === 'DEL' ? '⌫' : k}
          </button>
        ))}
      </div>
    </>
  );
}

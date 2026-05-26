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
                'relative flex aspect-[0.85] items-center justify-center rounded-[3px] border-[1.5px]',
                'font-mono text-[26px] font-bold uppercase',
                filled
                  ? 'border-gold bg-gold/20 text-gold'
                  : 'border-gold/35 bg-forest-mid/50 text-parchment',
              ].join(' ')}
            >
              {ch}
              {isCursor && (
                <span
                  aria-hidden="true"
                  className="absolute h-1/2 w-[2px] animate-blink bg-gold"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2 rounded-[4px] border border-gold/[0.18] bg-forest-mid/50 p-3.5">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="flex aspect-[1.5] items-center justify-center rounded-[3px] border border-gold/25 bg-[rgba(10,18,8,0.6)] font-mono text-[20px] font-bold text-parchment transition-[background] duration-[80ms] active:bg-gold/20 active:text-gold"
            aria-label={k === 'DEL' ? 'Backspace' : `Key ${k}`}
          >
            {k === 'DEL' ? '⌫' : k}
          </button>
        ))}
      </div>
    </>
  );
}

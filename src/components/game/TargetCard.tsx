import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type TargetCardProps = {
  photoPath: string | null;
  hint: string | null;
  pointValue: number;
  sharpenLevel: 0 | 1 | 2 | 3;
  hintRevealed: boolean;
};

const BLUR_BY_LEVEL = [20, 10, 4, 0];
const RESOLUTION_BY_LEVEL = [4, 24, 64, 100];

export function TargetCard({ photoPath, hint, pointValue, sharpenLevel, hintRevealed }: TargetCardProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!photoPath) { setSignedUrl(null); return; }
    supabase.storage.from('round-photos').createSignedUrl(photoPath, 600).then(({ data }) => {
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [photoPath]);

  const blur = BLUR_BY_LEVEL[sharpenLevel];
  const resolution = RESOLUTION_BY_LEVEL[sharpenLevel];

  return (
    <div className="rounded-[4px] border border-gold/25 bg-forest-mid/50 p-3.5" data-testid="target-card">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-parchment/60">Target Object</span>
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-gold">★ {pointValue} pts</span>
      </div>

      <div
        className="relative mt-2.5 h-[175px] w-full overflow-hidden rounded-[3px] border border-gold/20 bg-ink"
        style={{ viewTransitionName: 'target-photo' }}
      >
        {signedUrl ? (
          <img
            src={signedUrl}
            alt="Target"
            className="h-full w-full object-cover transition-[filter] duration-500"
            style={{ filter: `blur(${blur}px) saturate(${0.6 + sharpenLevel * 0.13})` }}
            data-testid="target-photo"
            data-blur={blur}
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-mono text-[10px] uppercase tracking-[0.25em] text-parchment/30">
            target locked
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded-[2px] bg-[rgba(10,18,8,0.85)] px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.15em] text-gold">
          Resolution: {resolution}%
        </div>
      </div>

      <div className="mt-2.5 rounded-[0_3px_3px_0] border-l-[3px] border-gold bg-[rgba(10,18,8,0.5)] px-3 py-2.5 font-serif text-[14px] italic text-parchment">
        <span className="block font-display text-[10px] font-normal not-italic uppercase tracking-[0.15em] text-parchment/60">
          Hider&apos;s Hint
        </span>
        {hint && hintRevealed ? hint : hint ? '— tap USE HINT to reveal —' : '(no hint this round)'}
      </div>
    </div>
  );
}

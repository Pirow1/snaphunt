// Matches snaphunt.html .target-card — brutal-shadow cream-2 card with
// blurred photo + reveal-meta + gold-left-border hint strip.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type TargetCardProps = {
  photoPath: string | null;
  hint: string | null;
  pointValue: number;
  /** 0 = fully blurred, 1 / 2 / 3 = progressively sharper. */
  sharpenLevel: 0 | 1 | 2 | 3;
  /** Whether the hint has been spent. */
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
    <div className="border-2 border-ink bg-cream-2 p-3.5 shadow-brutal" data-testid="target-card">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em]">Target Object</span>
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-blaze">★ {pointValue} pts</span>
      </div>

      <div
        className="relative mt-2.5 h-[180px] w-full overflow-hidden border-2 border-ink bg-ink"
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
          <div className="grid h-full w-full place-items-center font-mono text-[10px] uppercase tracking-[0.25em] text-cream/40">
            target locked
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-ink px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.15em] text-cream">
          Resolution: {resolution}%
        </div>
      </div>

      <div className="mt-2.5 border-l-4 border-gold bg-cream px-3 py-2.5 font-serif text-[14px] italic text-ink">
        <span className="block font-display text-[10px] font-normal not-italic uppercase tracking-[0.15em] text-ink-soft">
          Hider&apos;s Hint
        </span>
        {hint && hintRevealed ? hint : hint ? '— tap USE HINT to reveal —' : '(no hint this round)'}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const BLUR_BY_LEVEL = [20, 10, 4, 0];
const RESOLUTION_BY_LEVEL = [4, 24, 64, 100];

type BombCardProps = {
  photoPath: string | null;
  pointValue?: number;
  sharpenLevel: 0 | 1 | 2 | 3;
};

export function BombCard({ photoPath, pointValue = 100, sharpenLevel }: BombCardProps) {
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
    <div className="rounded-[2px] border-2 border-rim bg-surface p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">Bomb Location</span>
        <span className="font-display text-[16px] text-spark">★ {pointValue} pts</span>
      </div>

      <div
        className="relative h-[160px] w-full overflow-hidden rounded-[2px] border border-rim bg-void"
        style={{ viewTransitionName: 'target-photo' }}
      >
        {signedUrl ? (
          <img
            src={signedUrl}
            alt="Bomb location"
            className="h-full w-full object-cover transition-[filter] duration-500"
            style={{ filter: `blur(${blur}px) saturate(${0.6 + sharpenLevel * 0.13})` }}
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
            awaiting plant…
          </div>
        )}
        <div className="absolute bottom-2 right-2 rounded-[2px] bg-void/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-spark">
          {resolution}% res
        </div>
        {/* Corner brackets */}
        <span className="pointer-events-none absolute left-1.5 top-1.5 h-4 w-4 border-l-2 border-t-2 border-spark" />
        <span className="pointer-events-none absolute right-1.5 top-1.5 h-4 w-4 border-r-2 border-t-2 border-spark" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-4 w-4 border-b-2 border-l-2 border-spark" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-4 w-4 border-b-2 border-r-2 border-spark" />
      </div>
    </div>
  );
}

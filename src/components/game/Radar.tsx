// Matches snaphunt.html .radar — CSS-only grid, sweep beam, blaze ping,
// distance readout, temp-band label, and a centred BearingArrow overlay.

import { BearingArrow } from './BearingArrow';

export type Temp = 'BURNING' | 'HOT' | 'WARM' | 'COLD' | 'FROZEN';

export function tempFromDistance(d: number): { label: Temp; icon: string; color: string } {
  if (d < 12)  return { label: 'BURNING', icon: '🔥', color: 'text-blaze' };
  if (d < 40)  return { label: 'HOT',     icon: '⚠',  color: 'text-gold' };
  if (d < 100) return { label: 'WARM',    icon: '↑',  color: 'text-gold' };
  if (d < 180) return { label: 'COLD',    icon: '↓',  color: 'text-[#9BB7D4]' };
  return { label: 'FROZEN', icon: '✦', color: 'text-[#9BB7D4]' };
}

type RadarProps = {
  distanceMeters: number | null;
  accuracyMeters: number | null;
  targetLat: number;
  targetLng: number;
  /** mm:ss countdown rendered in the bottom-right; pass empty for none. */
  timer?: string;
};

export function Radar({ distanceMeters, accuracyMeters, targetLat, targetLng, timer = '' }: RadarProps) {
  const d = distanceMeters === null ? null : Math.round(distanceMeters);
  const temp = d !== null ? tempFromDistance(d) : null;

  return (
    <div className="relative h-40 overflow-hidden border-2 border-ink bg-ink shadow-brutal" data-testid="radar">
      {/* concentric grid (gold lines, 3 rings + crosshair) */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 50% 50%, transparent 0, transparent 30px, rgba(232,181,71,0.20) 31px, transparent 32px)',
            'radial-gradient(circle at 50% 50%, transparent 0, transparent 60px, rgba(232,181,71,0.15) 61px, transparent 62px)',
            'radial-gradient(circle at 50% 50%, transparent 0, transparent 90px, rgba(232,181,71,0.10) 91px, transparent 92px)',
            'linear-gradient(0deg,  transparent 49%, rgba(232,181,71,0.10) 49.5%, rgba(232,181,71,0.10) 50.5%, transparent 51%)',
            'linear-gradient(90deg, transparent 49%, rgba(232,181,71,0.10) 49.5%, rgba(232,181,71,0.10) 50.5%, transparent 51%)',
          ].join(','),
        }}
      />

      {/* sweep beam — 3s linear rotate, gold gradient, triangle clip */}
      <div
        aria-hidden="true"
        className="absolute top-0 h-full"
        style={{
          left: '50%',
          width: '50%',
          background: 'linear-gradient(90deg, transparent 0%, rgba(232,181,71,0.4) 90%, var(--gold) 100%)',
          transformOrigin: 'left center',
          animation: 'radar-sweep 3s linear infinite',
          clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
        }}
        data-testid="radar-sweep"
      />

      {/* pulsing blaze ping in the upper-right quadrant */}
      <div
        aria-hidden="true"
        className="absolute h-2 w-2 rounded-full bg-blaze"
        style={{ top: '35%', left: '65%', animation: 'radar-ping 1.5s ease-out infinite', boxShadow: '0 0 0 0 rgba(233,79,42,0.6)' }}
      />

      {/* centred bearing arrow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-10 -translate-x-1/2 -translate-y-1/2">
        <BearingArrow
          targetLat={targetLat}
          targetLng={targetLng}
          className="h-full w-6 text-blaze drop-shadow-[0_0_8px_rgba(233,79,42,0.6)]"
        />
      </div>

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 font-mono text-gold">
        <div className="flex justify-between text-[10px] tracking-[0.15em]">
          <span>◉ Tracking</span>
          <span data-testid="radar-acc">{accuracyMeters !== null ? `±${Math.round(accuracyMeters)}m` : '—'}</span>
        </div>

        <div>
          <div
            className="text-center font-mono text-[38px] font-bold tracking-tight"
            style={{ textShadow: '0 0 12px rgba(232,181,71,0.6)' }}
            data-testid="distance"
          >
            {d === null ? '—' : <>{d}<span className="ml-0.5 text-sm opacity-70">m</span></>}
          </div>
          <div
            className={`text-center font-display text-[13px] font-bold uppercase tracking-[0.15em] ${temp?.color ?? 'text-gold'}`}
            style={{ textShadow: '0 0 8px currentColor' }}
            data-testid="temp"
          >
            {temp ? `${temp.icon} ${temp.label}` : '—'}
          </div>
        </div>

        <div className="flex justify-between text-[10px] tracking-[0.15em]">
          <span>Hider Bearing</span>
          <span data-testid="timer">{timer}</span>
        </div>
      </div>
    </div>
  );
}

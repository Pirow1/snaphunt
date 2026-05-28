import { BearingArrow } from './BearingArrow';

export type Temp = 'BURNING' | 'HOT' | 'WARM' | 'COLD' | 'FROZEN';

export function tempFromDistance(d: number): { label: Temp; icon: string; color: string } {
  if (d < 12)  return { label: 'BURNING', icon: '🔥', color: 'text-ember' };
  if (d < 40)  return { label: 'HOT',     icon: '⚠',  color: 'text-gold' };
  if (d < 100) return { label: 'WARM',    icon: '↑',  color: 'text-gold' };
  if (d < 180) return { label: 'COLD',    icon: '↓',  color: 'text-[#9BB7D4]' };
  return { label: 'FROZEN', icon: '✦', color: 'text-[#9BB7D4]' };
}

// Sweep duration in seconds: 4s when far, speeds up to 0.8s when very close.
function sweepDuration(distM: number | null): number {
  if (distM === null) return 4;
  if (distM <= 5)   return 0.8;
  if (distM <= 20)  return 1.2;
  if (distM <= 50)  return 2.0;
  if (distM <= 100) return 3.0;
  return 4.0;
}

type RadarProps = {
  distanceMeters: number | null;
  accuracyMeters: number | null;
  targetLat: number;
  targetLng: number;
  pingFlash?: boolean; // set to true briefly on each radar ping
  timer?: string;
};

export function Radar({ distanceMeters, accuracyMeters, targetLat, targetLng, pingFlash = false, timer = '' }: RadarProps) {
  const d = distanceMeters === null ? null : Math.round(distanceMeters);
  const temp = d !== null ? tempFromDistance(d) : null;
  const sweep = sweepDuration(distanceMeters);
  const isClose = d !== null && d <= 20;

  return (
    <div
      className="relative h-[155px] overflow-hidden rounded-[4px] border border-gold/25 bg-[rgba(6,10,4,0.9)] transition-colors duration-300"
      style={isClose ? { borderColor: 'rgba(255,32,32,0.5)', boxShadow: '0 0 12px rgba(255,32,32,0.15)' } : undefined}
      data-testid="radar"
    >
      {/* concentric grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 50% 50%, transparent 0, transparent 30px, rgba(200,168,75,0.18) 31px, transparent 32px)',
            'radial-gradient(circle at 50% 50%, transparent 0, transparent 60px, rgba(200,168,75,0.12) 61px, transparent 62px)',
            'radial-gradient(circle at 50% 50%, transparent 0, transparent 90px, rgba(200,168,75,0.08) 91px, transparent 92px)',
            'linear-gradient(0deg,  transparent 49%, rgba(200,168,75,0.08) 49.5%, rgba(200,168,75,0.08) 50.5%, transparent 51%)',
            'linear-gradient(90deg, transparent 49%, rgba(200,168,75,0.08) 49.5%, rgba(200,168,75,0.08) 50.5%, transparent 51%)',
          ].join(','),
        }}
      />

      {/* sweep beam — speed scales with proximity */}
      <div
        aria-hidden="true"
        className="absolute top-0 h-full"
        style={{
          left: '50%',
          width: '50%',
          background: isClose
            ? 'linear-gradient(90deg, transparent 0%, rgba(255,32,32,0.35) 90%, rgba(255,32,32,0.9) 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(200,168,75,0.35) 90%, var(--gold) 100%)',
          transformOrigin: 'left center',
          animation: `radar-sweep ${sweep}s linear infinite`,
          clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
        }}
        data-testid="radar-sweep"
      />

      {/* ping flash overlay — briefly illuminates on each radar ping audio event */}
      {pingFlash && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[4px]"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(200,168,75,0.18) 0%, transparent 70%)', animation: 'radar-ping 0.4s ease-out forwards' }}
        />
      )}

      {/* target blip */}
      <div
        aria-hidden="true"
        className={`absolute h-2 w-2 rounded-full ${isClose ? 'bg-threat' : 'bg-ember'}`}
        style={{ top: '35%', left: '65%', animation: 'radar-ping 1.5s ease-out infinite', boxShadow: `0 0 0 0 ${isClose ? 'rgba(255,32,32,0.7)' : 'rgba(200,74,26,0.7)'}` }}
      />

      {/* bearing arrow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-10 -translate-x-1/2 -translate-y-1/2">
        <BearingArrow
          targetLat={targetLat}
          targetLng={targetLng}
          className={`h-full w-6 drop-shadow-[0_0_8px_rgba(200,74,26,0.6)] ${isClose ? 'text-threat' : 'text-ember'}`}
        />
      </div>

      {/* HUD overlay */}
      <div className={`pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 font-mono ${isClose ? 'text-threat' : 'text-gold'}`}>
        <div className="flex justify-between text-[10px] tracking-[0.15em]">
          <span>{isClose ? '⚠ CLOSE' : '◉ Tracking'}</span>
          <span data-testid="radar-acc">{accuracyMeters !== null ? `±${Math.round(accuracyMeters)}m` : '—'}</span>
        </div>

        <div>
          <div
            className="text-center font-mono text-[36px] font-bold tracking-tight"
            style={{ textShadow: isClose ? '0 0 12px rgba(255,32,32,0.6)' : '0 0 12px rgba(200,168,75,0.5)' }}
            data-testid="distance"
          >
            {d === null ? '—' : <>{d}<span className="ml-0.5 text-sm opacity-70">m</span></>}
          </div>
          <div
            className={`text-center font-display text-[12px] font-bold uppercase tracking-[0.15em] ${temp?.color ?? 'text-gold'}`}
            style={{ textShadow: '0 0 8px currentColor' }}
            data-testid="temp"
          >
            {temp ? `${temp.icon} ${temp.label}` : '—'}
          </div>
        </div>

        <div className="flex justify-between text-[10px] tracking-[0.15em]">
          <span>Bomb Bearing</span>
          <span data-testid="timer">{timer}</span>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { BombTimer } from '../components/game/BombTimer';
import { BombCard } from '../components/game/BombCard';
import { DefusalPuzzle } from '../components/game/DefusalPuzzle';
import { Radar } from '../components/game/Radar';
import RoleRevealScreen from './RoleRevealScreen';
import ResultScreen from './ResultScreen';
import {
  playBombPlant, playShutter, playCountdownBeep,
  playDefused, playExplosion, getHeartbeatBand, playHeartbeatPulse,
  type HeartbeatBand,
} from '../lib/audio';

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="warning-stripe h-[4px] w-full mb-3" />
      <div className="font-display text-[18px] tracking-[0.1em] text-ash uppercase mb-4 px-5">{title}</div>
      <div className="px-5 space-y-3">{children}</div>
    </section>
  );
}

function SoundBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [flash, setFlash] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { onClick(); setFlash(true); setTimeout(() => setFlash(false), 200); }}
      className={`rounded-[2px] border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors
        ${flash ? 'border-spark bg-spark/20 text-spark' : 'border-rim bg-surface text-smoke hover:border-spark/60'}`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function FeatureDemoScreen() {
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [puzzleResult, setPuzzleResult] = useState<'—' | 'DEFUSED ✓' | 'FAILED ✗'>('—');

  // ── Bomb Timer
  const [timerExpiry, setTimerExpiry] = useState<string | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);

  function startTimer(seconds: number) {
    const t = new Date(Date.now() + seconds * 1000).toISOString();
    setTimerExpiry(t);
    setTimerExpired(false);
  }

  // ── Heartbeat
  const DIST_PRESETS = [1, 5, 15, 40, 65, 100, 200] as const;
  const [activeDist, setActiveDist] = useState<number | null>(null);
  const [heartbeatBand, setHeartbeatBand] = useState<HeartbeatBand | null>(null);
  const [pulse, setPulse] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    setHeartbeatBand(null);
    setPulse(false);
  }, []);

  const startHeartbeat = useCallback((dist: number) => {
    stopHeartbeat();
    const band = getHeartbeatBand(dist);
    setHeartbeatBand(band);
    if (!band) return;
    const fire = () => { playHeartbeatPulse(band.volume); setPulse(true); setTimeout(() => setPulse(false), 120); };
    fire();
    heartbeatRef.current = setInterval(fire, band.intervalMs);
  }, [stopHeartbeat]);

  useEffect(() => {
    if (activeDist === null) { stopHeartbeat(); return; }
    startHeartbeat(activeDist);
    return stopHeartbeat;
  }, [activeDist, startHeartbeat, stopHeartbeat]);

  // ── BombCard sharpen
  const [sharpenLevel, setSharpenLevel] = useState<0 | 1 | 2 | 3>(0);

  // ── Role reveal inline preview
  const [previewRole, setPreviewRole] = useState<'planter' | 'defuser'>('planter');
  const [roleKey, setRoleKey] = useState(0); // remounts to re-trigger animation

  // ── Result inline preview
  const [resultOutcome, setResultOutcome] = useState<'defused' | 'exploded'>('defused');
  const [resultKey, setResultKey] = useState(0);

  return (
    <main className="min-h-full w-full bg-void text-smoke pb-12">
      {/* Header */}
      <div className="warning-stripe h-[8px] w-full" />
      <div className="px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ash">Dev</div>
        <div className="font-display text-[36px] tracking-[0.06em] text-spark">FEATURE DEMO</div>
      </div>

      {/* ── 1. SOUNDS ─────────────────────────────────────────── */}
      <Section title="Sound FX">
        <div className="grid grid-cols-2 gap-2">
          <SoundBtn label="💣 Bomb Plant"         onClick={playBombPlant} />
          <SoundBtn label="📷 Shutter"             onClick={playShutter} />
          <SoundBtn label="🔔 Countdown"           onClick={() => playCountdownBeep(false)} />
          <SoundBtn label="🚨 Urgent Beep"         onClick={() => playCountdownBeep(true)} />
          <SoundBtn label="✓ Defused"              onClick={playDefused} />
          <SoundBtn label="💥 Explosion"           onClick={playExplosion} />
        </div>
      </Section>

      {/* ── 2. PROXIMITY HEARTBEAT ────────────────────────────── */}
      <Section title="Proximity Heartbeat">
        <div className="grid grid-cols-4 gap-2">
          {DIST_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDist(activeDist === d ? null : d)}
              className={`rounded-[2px] border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors
                ${activeDist === d ? 'border-spark bg-spark/20 text-spark' : 'border-rim bg-surface text-ash hover:border-spark/40'}`}
            >
              {d}m
            </button>
          ))}
        </div>

        <div className={`mt-3 rounded-[2px] border ${activeDist === null ? 'border-rim' : 'border-spark/40'} bg-surface px-4 py-3 flex items-center gap-4`}>
          <div
            className={`h-5 w-5 rounded-full transition-all duration-100 ${pulse ? 'bg-spark scale-125' : 'bg-spark/20 scale-100'}`}
          />
          <div className="flex-1">
            {activeDist === null ? (
              <span className="font-mono text-[11px] text-ash">Select a distance above to start</span>
            ) : heartbeatBand ? (
              <>
                <div className="font-mono text-[11px] text-smoke">{activeDist}m → every {heartbeatBand.intervalMs}ms</div>
                <div className="font-mono text-[10px] text-ash mt-0.5">vol {Math.round(heartbeatBand.volume * 100)}%</div>
              </>
            ) : (
              <span className="font-mono text-[11px] text-ash">{activeDist}m — out of range ({'>'} 100m)</span>
            )}
          </div>
          {activeDist !== null && (
            <button type="button" onClick={() => setActiveDist(null)} className="font-mono text-[10px] text-ash/60 underline">stop</button>
          )}
        </div>
      </Section>

      {/* ── 3. BOMB TIMER ─────────────────────────────────────── */}
      <Section title="Bomb Timer">
        <div className="grid grid-cols-4 gap-2">
          {[{ label: '1 min', s: 60 }, { label: '30 sec', s: 30 }, { label: '10 sec', s: 10 }, { label: 'Reset', s: 0 }].map(({ label, s }) => (
            <button
              key={label}
              type="button"
              onClick={() => { if (s === 0) { setTimerExpiry(null); setTimerExpired(false); } else startTimer(s); }}
              className="rounded-[2px] border border-rim bg-surface px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ash hover:border-spark/60 hover:text-smoke transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <BombTimer expiresAt={timerExpiry} onExpired={() => setTimerExpired(true)} />
        </div>
        {timerExpired && (
          <div className="mt-2 font-mono text-[11px] text-threat text-center uppercase tracking-[0.15em]">
            💥 onExpired callback fired
          </div>
        )}
      </Section>

      {/* ── 4. BOMB CARD (sharpen) ────────────────────────────── */}
      <Section title="Bomb Card — Sharpen Levels">
        <div className="grid grid-cols-4 gap-2">
          {([0, 1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSharpenLevel(lvl)}
              className={`rounded-[2px] border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors
                ${sharpenLevel === lvl ? 'border-spark bg-spark/20 text-spark' : 'border-rim bg-surface text-ash hover:border-spark/40'}`}
            >
              Lvl {lvl}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <BombCard photoPath={null} sharpenLevel={sharpenLevel} />
        </div>
        <div className="font-mono text-[10px] text-ash/60 text-center mt-1">
          (No real photo in demo — connect Supabase to show a real image)
        </div>
      </Section>

      {/* ── 5. RADAR ──────────────────────────────────────────── */}
      <Section title="Radar — Distance Simulation">
        <div className="grid grid-cols-3 gap-2">
          {[{ label: '3m' }, { label: '25m' }, { label: '80m' }, { label: '150m' }, { label: '500m' }, { label: 'No GPS' }].map(({ label }) => (
            <button
              key={label}
              type="button"
              onClick={() => {}}
              className="rounded-[2px] border border-rim bg-surface px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ash"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Radar distanceMeters={25} accuracyMeters={5} targetLat={-33.87} targetLng={18.42} />
        </div>
        <div className="font-mono text-[10px] text-ash/60 text-center mt-1">
          Static 25m demo — GPS and compass needed for live bearing
        </div>
      </Section>

      {/* ── 6. DEFUSAL PUZZLE ─────────────────────────────────── */}
      <Section title="Defusal Puzzle">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setShowPuzzle(true); setPuzzleResult('—'); }}
            className="flex-1 rounded-[2px] border-2 border-spark bg-spark/10 py-3 font-display text-[20px] tracking-[0.06em] text-spark active:scale-[0.97] transition-transform"
          >
            💣 OPEN PUZZLE
          </button>
          <div className={`font-mono text-[13px] uppercase tracking-[0.15em] min-w-[90px] text-center
            ${puzzleResult === 'DEFUSED ✓' ? 'text-clear' : puzzleResult === 'FAILED ✗' ? 'text-threat' : 'text-ash'}`}>
            {puzzleResult}
          </div>
        </div>
        <div className="font-mono text-[10px] text-ash/60">
          Each click generates a fresh random puzzle. Solve to see DEFUSED, fail to see FAILED.
        </div>

        {showPuzzle && (
          <DefusalPuzzle
            onDefused={() => { setShowPuzzle(false); setPuzzleResult('DEFUSED ✓'); }}
            onFailed={() => { setShowPuzzle(false); setPuzzleResult('FAILED ✗'); }}
          />
        )}
      </Section>

      {/* ── 7. ROLE REVEAL ────────────────────────────────────── */}
      <Section title="Role Reveal">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setPreviewRole('planter'); setRoleKey((k) => k + 1); }}
            className={`rounded-[2px] border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors
              ${previewRole === 'planter' ? 'border-threat bg-threat/20 text-threat' : 'border-rim bg-surface text-ash'}`}
          >
            💣 Planter
          </button>
          <button
            type="button"
            onClick={() => { setPreviewRole('defuser'); setRoleKey((k) => k + 1); }}
            className={`rounded-[2px] border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors
              ${previewRole === 'defuser' ? 'border-spark bg-spark/20 text-spark' : 'border-rim bg-surface text-ash'}`}
          >
            🔍 Defuser
          </button>
        </div>
        <div className="mt-3 rounded-[2px] border border-rim overflow-hidden" style={{ height: 320 }}>
          <div className="relative h-full w-full">
            <RoleRevealScreen
              key={roleKey}
              role={previewRole}
              planterName="Ruben"
              onAccept={() => {}}
            />
          </div>
        </div>
      </Section>

      {/* ── 8. RESULT SCREEN ──────────────────────────────────── */}
      <Section title="Result Screen">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setResultOutcome('defused'); setResultKey((k) => k + 1); }}
            className={`rounded-[2px] border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors
              ${resultOutcome === 'defused' ? 'border-clear bg-clear/20 text-clear' : 'border-rim bg-surface text-ash'}`}
          >
            ✓ Defused
          </button>
          <button
            type="button"
            onClick={() => { setResultOutcome('exploded'); setResultKey((k) => k + 1); }}
            className={`rounded-[2px] border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors
              ${resultOutcome === 'exploded' ? 'border-threat bg-threat/20 text-threat' : 'border-rim bg-surface text-ash'}`}
          >
            💥 Detonated
          </button>
        </div>
        <div className="mt-3 rounded-[2px] border border-rim overflow-hidden" style={{ height: 320 }}>
          <ResultScreen key={resultKey} outcome={resultOutcome} onContinue={() => {}} />
        </div>
      </Section>

      <div className="warning-stripe h-[8px] w-full" />
    </main>
  );
}

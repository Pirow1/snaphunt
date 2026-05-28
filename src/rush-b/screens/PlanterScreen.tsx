import { useState } from 'react';
import { useStore } from '../lib/store';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { PhotoCapture } from '../components/game/PhotoCapture';
import { BOMB_TIMER_OPTIONS } from '../lib/types';
import { playBombPlant } from '../lib/audio';

export default function PlanterScreen() {
  const plantBomb = useStore((s) => s.plantBomb);
  const visionReady = useStore((s) => s.visionReady);
  const visionProgress = useStore((s) => s.visionLoadProgress);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(BOMB_TIMER_OPTIONS[1]!.seconds);
  const [phase, setPhase] = useState<'idle' | 'encoding' | 'uploading' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  function onCapture(picked: File) {
    setFile(picked);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(picked));
    setError(null);
  }

  async function onPlant() {
    if (!file) { setError('Photograph the bomb location first.'); return; }
    if (!visionReady) { setError(`Vision loading (${visionProgress}%) — try again shortly.`); return; }
    setError(null);
    setPhase('encoding');
    try {
      await plantBomb({ file, bombTimerSeconds: timerSeconds });
      playBombPlant();
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to plant bomb.');
      setPhase('idle');
    }
  }

  const submitting = phase !== 'idle' && phase !== 'done';

  return (
    <main className="flex h-full w-full flex-col bg-void text-smoke">
      <TopBar title="Plant Bomb" right={<TopBarBadge tone="red">Planter</TopBarBadge>} />

      <div className="flex flex-1 flex-col px-5 pt-3 pb-5 overflow-y-auto">
        {/* Photo area */}
        <div
          className="relative mb-4 flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-[2px] border-2 border-dashed border-threat/50 bg-surface"
          style={{ viewTransitionName: 'target-photo' }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Bomb location" className="h-full w-full object-cover" />
          ) : (
            <div className="px-8 text-center">
              <div className="font-rb-display text-[64px] leading-none opacity-30">💣</div>
              <p className="mt-3 font-rb-mono text-[11px] uppercase tracking-[0.15em] text-ash/70 leading-relaxed">
                Find a good hiding spot.<br />Frame it. Photograph it.
              </p>
            </div>
          )}
          <span className="pointer-events-none absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-threat" />
          <span className="pointer-events-none absolute right-2 top-2 h-5 w-5 border-r-2 border-t-2 border-threat" />
          <span className="pointer-events-none absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-threat" />
          <span className="pointer-events-none absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-threat" />
        </div>

        {/* Timer selection */}
        <div className="mb-4">
          <span className="block font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-2">
            Bomb Timer
          </span>
          <div className="grid grid-cols-4 gap-2">
            {BOMB_TIMER_OPTIONS.map(({ label, seconds }) => (
              <button
                key={seconds}
                type="button"
                onClick={() => setTimerSeconds(seconds)}
                aria-pressed={timerSeconds === seconds}
                className={[
                  'rounded-[2px] border-2 py-3 text-center font-rb-display text-[18px] tracking-[0.04em] transition-all',
                  timerSeconds === seconds
                    ? 'border-threat bg-threat/20 text-threat'
                    : 'border-rim bg-surface text-ash active:scale-[0.97]',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-[2px] border border-threat/50 bg-threat/10 px-3 py-2 font-rb-mono text-[11px] text-threat">
            {error}
          </div>
        )}
        {submitting && (
          <div className="mb-3 rounded-[2px] border border-rim bg-surface px-3 py-2 font-rb-mono text-[11px] uppercase tracking-[0.15em] text-ash animate-blink">
            {phase === 'encoding' ? 'encoding location…' : phase}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-auto">
          <PhotoCapture
            onCapture={onCapture}
            ariaLabel="Photograph location"
            buttonProps={{
              className: 'flex w-full items-center justify-center gap-2 rounded-[2px] border-2 border-rim bg-surface px-4 py-[17px] font-rb-display text-[16px] text-smoke transition-transform active:scale-[0.97] disabled:opacity-40',
              disabled: submitting,
            }}
          >
            📷 Photograph
          </PhotoCapture>
          <button
            type="button"
            onClick={onPlant}
            disabled={!file || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[2px] border-2 border-threat bg-threat px-4 py-[17px] font-rb-display text-[16px] text-chalk transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            💣 Plant
          </button>
        </div>
      </div>
    </main>
  );
}

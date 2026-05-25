// Matches snaphunt.html #screen-hider — dashed-bordered capture-target with
// blaze corner brackets, crosshair placeholder before capture, image preview
// after, difficulty chip row (Easy/Medium/Legendary with gold-active state),
// italic Fraunces hint textarea, Capture + Set Trap CTAs side-by-side.

import { useState } from 'react';
import { useStore } from '../lib/store';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { PhotoCapture } from '../components/game/PhotoCapture';
import type { Difficulty } from '../lib/types';

const DIFFS: { id: Difficulty; label: string; pts: number }[] = [
  { id: 'easy',       label: 'Easy',       pts: 50 },
  { id: 'medium',     label: 'Medium',     pts: 100 },
  { id: 'legendary',  label: 'Legendary',  pts: 250 },
];

export default function HiderCaptureScreen() {
  const setTrap = useStore((s) => s.setTrap);
  const visionReady = useStore((s) => s.visionReady);
  const visionProgress = useStore((s) => s.visionLoadProgress);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [hint, setHint] = useState('');
  const [phase, setPhase] = useState<'idle' | 'encoding' | 'uploading' | 'pinning' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  function onCapture(picked: File) {
    setFile(picked);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(picked));
    setError(null);
  }

  async function onSetTrap() {
    if (!file) {
      setError('Capture a photo first.');
      return;
    }
    if (!visionReady) {
      setError(`Vision model still loading (${visionProgress}%) — try again in a moment.`);
      return;
    }
    setError(null);
    setPhase('encoding');
    try {
      await setTrap({ file, difficulty, hint });
      setPhase('done');
      // GameRouter sees round.status='active' → renders HiderWaitScreen.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set trap.');
      setPhase('idle');
    }
  }

  const submitting = phase !== 'idle' && phase !== 'done';

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <TopBar
        title="Hide Something"
        right={<TopBarBadge tone="dark"><span className="text-cream" style={{ color: 'var(--cream)' }}>Hider</span></TopBarBadge>}
      />

      <div className="flex flex-1 flex-col px-[22px] pt-3 pb-[22px]">
        {/* Capture target with blaze corner brackets */}
        <div
          className="relative mb-4 flex min-h-[280px] flex-1 items-center justify-center overflow-hidden border-2 border-dashed border-ink bg-cream-2"
          style={{ viewTransitionName: 'target-photo' }}
          data-testid="capture-target"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Captured" className="h-full w-full object-cover" />
          ) : (
            <div className="px-8 text-center">
              <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 h-20 w-20">
                <circle cx="40" cy="40" r="30" fill="none" stroke="#1A1614" strokeWidth="2" />
                <circle cx="40" cy="40" r="6"  fill="#E94F2A" />
                <line x1="40" y1="5"  x2="40" y2="20" stroke="#1A1614" strokeWidth="2" />
                <line x1="40" y1="60" x2="40" y2="75" stroke="#1A1614" strokeWidth="2" />
                <line x1="5"  y1="40" x2="20" y2="40" stroke="#1A1614" strokeWidth="2" />
                <line x1="60" y1="40" x2="75" y2="40" stroke="#1A1614" strokeWidth="2" />
              </svg>
              <p className="font-display text-sm font-semibold text-ink-soft">
                Find a fixed, distinctive object.
                <br />
                Frame it well. Snap it.
              </p>
            </div>
          )}

          {/* Blaze corner brackets — 24x24 ::before/::after equivalent */}
          <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2     h-6 w-6 border-l-[3px] border-t-[3px] border-blaze" />
          <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2    h-6 w-6 border-r-[3px] border-t-[3px] border-blaze" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2  h-6 w-6 border-l-[3px] border-b-[3px] border-blaze" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 h-6 w-6 border-r-[3px] border-b-[3px] border-blaze" />
        </div>

        {/* Difficulty chips */}
        <div className="mb-3.5">
          <span className="block mb-2 font-display text-[11px] font-bold uppercase tracking-[0.18em]">
            Difficulty Tier
          </span>
          <div className="grid grid-cols-3 gap-2">
            {DIFFS.map((d) => {
              const active = d.id === difficulty;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  aria-pressed={active}
                  className={[
                    'border-2 border-ink px-2 py-2.5 text-center font-display text-[11px] font-bold uppercase tracking-[0.1em]',
                    'shadow-[3px_3px_0_var(--ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--ink)]',
                    active ? 'bg-gold' : 'bg-cream',
                  ].join(' ')}
                  data-testid={`diff-${d.id}`}
                >
                  {d.label}
                  <span className="mt-0.5 block text-lg font-extrabold">+{d.pts}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hint */}
        <textarea
          rows={2}
          value={hint}
          onChange={(e) => setHint(e.target.value.slice(0, 200))}
          placeholder="Optional hint — leave a clue for the seekers..."
          className="mb-3.5 w-full resize-none border-2 border-ink bg-cream p-3.5 font-serif text-[15px] italic focus:bg-gold focus:outline-none"
          data-testid="hint-input"
        />

        {error && (
          <div className="mb-3 border-2 border-ink bg-blaze px-3 py-2 font-display text-sm font-bold text-cream">
            {error}
          </div>
        )}

        {submitting && (
          <div className="mb-3 border-2 border-ink bg-cream-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em]">
            {phase === 'encoding' ? 'encoding photo…' : phase}
          </div>
        )}

        {/* Capture / Set Trap pair */}
        <div className="grid grid-cols-2 gap-2.5">
          <PhotoCapture
            onCapture={onCapture}
            ariaLabel="Capture photo"
            buttonProps={{
              className:
                'flex w-full items-center justify-center gap-2 rounded-[2px] border-2 border-ink bg-ink px-[22px] py-[18px] font-display text-[17px] font-bold uppercase tracking-tight text-cream shadow-brutal transition-[transform,box-shadow] duration-[80ms] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)] disabled:opacity-40',
              'data-testid': 'capture-btn',
              disabled: submitting,
            }}
          >
            📷 Capture
          </PhotoCapture>
          <button
            type="button"
            onClick={onSetTrap}
            disabled={!file || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-[2px] border-2 border-ink bg-blaze px-[22px] py-[18px] font-display text-[17px] font-bold uppercase tracking-tight text-cream shadow-brutal transition-[transform,box-shadow] duration-[80ms] hover:bg-blaze-deep active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="set-trap"
          >
            Set Trap →
          </button>
        </div>
      </div>
    </main>
  );
}

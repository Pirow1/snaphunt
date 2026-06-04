import { useState } from 'react';
import { useStore } from '../lib/store';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { PhotoCapture } from '../components/game/PhotoCapture';
import { ForestBg } from '../components/ui/ForestBg';
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set trap.');
      setPhase('idle');
    }
  }

  const submitting = phase !== 'idle' && phase !== 'done';

  return (
    <main className="relative isolate flex h-full w-full flex-col bg-forest-dark text-parchment">
      <ForestBg />
      <TopBar
        title="Hide Something"
        right={<TopBarBadge>Hider</TopBarBadge>}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[22px] pt-3 pb-[22px]">
        {/* Capture target with gold corner brackets */}
        <div
          className="relative mb-4 flex min-h-[280px] flex-1 items-center justify-center overflow-hidden rounded-[3px] border-[1.5px] border-dashed border-gold/40 bg-forest-mid/40"
          style={{ viewTransitionName: 'target-photo' }}
          data-testid="capture-target"
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Captured" className="h-full w-full object-cover" />
          ) : (
            <div className="px-8 text-center">
              <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 h-20 w-20 opacity-35">
                <circle cx="40" cy="40" r="30" fill="none" stroke="#C8A84B" strokeWidth="2" />
                <circle cx="40" cy="40" r="6"  fill="#C84A1A" />
                <line x1="40" y1="5"  x2="40" y2="20" stroke="#C8A84B" strokeWidth="2" />
                <line x1="40" y1="60" x2="40" y2="75" stroke="#C8A84B" strokeWidth="2" />
                <line x1="5"  y1="40" x2="20" y2="40" stroke="#C8A84B" strokeWidth="2" />
                <line x1="60" y1="40" x2="75" y2="40" stroke="#C8A84B" strokeWidth="2" />
              </svg>
              <p className="font-serif text-[15px] italic leading-[1.5] text-parchment/65">
                Find a fixed, distinctive object.
                <br />
                Frame it well. Snap it.
              </p>
            </div>
          )}

          {/* Gold corner brackets */}
          <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2     h-6 w-6 border-l-[2.5px] border-t-[2.5px] border-gold" />
          <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2    h-6 w-6 border-r-[2.5px] border-t-[2.5px] border-gold" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2  h-6 w-6 border-l-[2.5px] border-b-[2.5px] border-gold" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-2 right-2 h-6 w-6 border-r-[2.5px] border-b-[2.5px] border-gold" />
        </div>

        {/* Difficulty chips */}
        <div className="mb-3.5">
          <span className="block mb-2 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-parchment/75">
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
                    'rounded-[3px] border-[1.5px] px-2 py-2.5 text-center font-display text-[10px] font-bold uppercase tracking-[0.08em] transition-all duration-150',
                    'active:scale-[0.97]',
                    active
                      ? 'border-gold bg-gold/20 text-gold'
                      : 'border-gold/25 bg-forest-mid/50 text-parchment/75',
                  ].join(' ')}
                  data-testid={`diff-${d.id}`}
                >
                  {d.label}
                  <span className="mt-0.5 block text-lg font-extrabold text-gold">+{d.pts}</span>
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
          className="mb-3.5 w-full resize-none rounded-[3px] border-[1.5px] border-gold/25 bg-forest-mid p-3.5 font-serif text-[14px] italic text-parchment placeholder:text-parchment/52 focus:border-gold focus:bg-forest-rich focus:outline-none"
          data-testid="hint-input"
        />

        {error && (
          <div className="mb-3 rounded-[3px] border border-ember/50 bg-ember/20 px-3 py-2 font-display text-sm font-bold text-parchment">
            {error}
          </div>
        )}

        {submitting && (
          <div className="mb-3 rounded-[3px] border border-gold/20 bg-forest-mid/50 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-parchment">
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
                'flex w-full items-center justify-center gap-2 rounded-[3px] border-[1.5px] border-gold/35 bg-[rgba(10,18,8,0.85)] px-[22px] py-[17px] font-display text-[15px] font-bold uppercase tracking-[0.06em] text-parchment backdrop-blur-sm transition-transform duration-[80ms] active:scale-[0.98] disabled:opacity-40',
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
            className="flex w-full items-center justify-center gap-2 rounded-[3px] border-[1.5px] border-gold bg-gold px-[22px] py-[17px] font-display text-[15px] font-extrabold uppercase tracking-[0.06em] text-forest-dark backdrop-blur-sm transition-transform duration-[80ms] active:scale-[0.98] hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="set-trap"
          >
            Set Trap →
          </button>
        </div>
      </div>
    </main>
  );
}

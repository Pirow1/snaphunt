// Dev-only diagnostic page for Pillar 1 — load two images, run them through
// CLIP, report cosine similarity + device + encode latency. Mounted at
// /vision-test in DEV builds only (App.tsx).

import { useEffect, useRef, useState } from 'react';
import { encodeImage, getActiveDevice, initVision, isVisionReady } from '../lib/vision';
import { cosine, magnitude } from '../lib/embeddings';
import { useStore } from '../lib/store';
import { TopBar } from '../components/ui/TopBar';

type Slot = { url: string | null; embedding: Float32Array | null; encodeMs: number | null };

const EMPTY: Slot = { url: null, embedding: null, encodeMs: null };

export default function VisionTestScreen() {
  const setVisionLoadProgress = useStore((s) => s.setVisionLoadProgress);
  const setVisionReady = useStore((s) => s.setVisionReady);
  const progress = useStore((s) => s.visionLoadProgress);
  const ready = useStore((s) => s.visionReady);
  const [device, setDevice] = useState<string>('—');
  const [slotA, setSlotA] = useState<Slot>(EMPTY);
  const [slotB, setSlotB] = useState<Slot>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const inputA = useRef<HTMLInputElement | null>(null);
  const inputB = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    initVision((pct) => setVisionLoadProgress(pct))
      .then((dev) => {
        setVisionReady(true);
        setDevice(dev);
      })
      .catch((e) => setErr(`initVision failed: ${e}`));
  }, [setVisionLoadProgress, setVisionReady]);

  // Keep device label fresh even on hot reload
  useEffect(() => {
    if (ready && device === '—') setDevice(getActiveDevice() ?? '?');
  }, [ready, device]);

  async function encode(file: File, set: (s: Slot) => void) {
    setErr(null);
    if (!isVisionReady()) {
      setErr('vision model still loading');
      return;
    }
    const url = URL.createObjectURL(file);
    const t0 = performance.now();
    try {
      const embedding = await encodeImage(file);
      const ms = Math.round(performance.now() - t0);
      set({ url, embedding, encodeMs: ms });
    } catch (e) {
      setErr(`encode failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const sim = slotA.embedding && slotB.embedding ? cosine(slotA.embedding, slotB.embedding) : null;
  const magA = slotA.embedding ? magnitude(slotA.embedding) : null;
  const magB = slotB.embedding ? magnitude(slotB.embedding) : null;

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <TopBar title="Vision Test" back="/" />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[22px] py-5">
        <section className="grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-[0.15em]">
          <div className="border-2 border-ink bg-cream-2 p-3">
            <div className="text-ink-soft">device</div>
            <div className="mt-1 text-lg font-bold lowercase tracking-normal">{device}</div>
          </div>
          <div className="border-2 border-ink bg-cream-2 p-3">
            <div className="text-ink-soft">load</div>
            <div className="mt-1 text-lg font-bold lowercase tracking-normal">
              {ready ? 'ready' : `${progress}%`}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {([
            { label: 'A', slot: slotA, set: setSlotA, ref: inputA },
            { label: 'B', slot: slotB, set: setSlotB, ref: inputB },
          ] as const).map(({ label, slot, set, ref }) => (
            <div key={label} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => ref.current?.click()}
                className="aspect-square w-full border-2 border-ink bg-cream-2 p-1 shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)]"
              >
                {slot.url ? (
                  <img src={slot.url} alt={`slot ${label}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center font-display text-3xl font-extrabold uppercase">
                    + {label}
                  </div>
                )}
              </button>
              <input
                ref={ref}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) encode(f, set);
                }}
                data-testid={`vt-input-${label}`}
              />
              <div className="font-mono text-[10px] text-ink-soft">
                {slot.embedding
                  ? `512 dim · ${slot.encodeMs}ms · |v|=${magnitude(slot.embedding).toFixed(4)}`
                  : 'no image'}
              </div>
            </div>
          ))}
        </section>

        <section className="border-2 border-ink bg-cream-2 p-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">cosine A · B</div>
          <div
            className="mt-1 font-mono text-5xl font-bold tracking-tight"
            data-testid="vt-cosine"
          >
            {sim === null ? '—' : sim.toFixed(4)}
          </div>
          <div className="mt-2 font-mono text-[10px] text-ink-soft">
            |a|={magA?.toFixed(4) ?? '—'} |b|={magB?.toFixed(4) ?? '—'}
          </div>
          {sim !== null && (
            <div className="mt-2 font-display text-xs font-bold uppercase tracking-[0.18em]">
              {sim >= 0.85 ? (
                <span className="text-forest">SAME OBJECT (auto-accept band)</span>
              ) : sim < 0.55 ? (
                <span className="text-blaze">DIFFERENT (auto-reject band)</span>
              ) : (
                <span className="text-plum">BORDERLINE (would escalate to Claude)</span>
              )}
            </div>
          )}
        </section>

        {err && (
          <div className="border-2 border-ink bg-blaze px-3 py-2 font-display text-sm font-bold text-cream">{err}</div>
        )}

        <div className="mt-auto font-mono text-[10px] text-ink-soft">
          DEV-only · cosine bands per spec §9: ≥0.85 auto-match · &lt;0.55 auto-reject · between → Claude
        </div>
      </div>
    </main>
  );
}

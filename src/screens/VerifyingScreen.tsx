import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';

const STEPS = [
  'Examining the evidence…',
  'Comparing pixel signatures…',
  'Sanity-checking the GPS pin…',
  'Asking the oracle…',
  'Sealing the verdict…',
];

export default function VerifyingScreen() {
  const submissionId = useStore((s) => s.currentSubmissionId);
  const round = useStore((s) => s.currentRound);
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(8);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [seekerUrl, setSeekerUrl] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
      setProgress((p) => Math.min(98, p + 18 + Math.random() * 6));
    }, 700);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (round?.photo_path) {
        const { data } = await supabase.storage.from('round-photos').createSignedUrl(round.photo_path, 600);
        if (!cancelled) setTargetUrl(data?.signedUrl ?? null);
      }
      if (submissionId) {
        const { data } = await supabase.storage.from('submission-photos').createSignedUrl(`${submissionId}.jpg`, 600);
        if (!cancelled) setSeekerUrl(data?.signedUrl ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [round?.photo_path, submissionId]);

  return (
    <main className="flex h-full w-full flex-col items-center justify-center bg-forest-dark px-6 text-parchment">
      <div className="flex items-center gap-3" data-testid="verifying">
        <Photo url={targetUrl} label="Target" delay="0s" />
        <span className="font-serif text-2xl italic text-parchment/50">vs.</span>
        <Photo url={seekerUrl} label="Yours" delay="0.7s" />
      </div>

      <h2 className="mt-7 font-display text-[30px] font-extrabold uppercase tracking-[-0.04em] text-gold font-squeeze"
        style={{ fontVariationSettings: "'wdth' 75" }}>
        Cross-Referencing
      </h2>
      <p className="mt-2 font-serif text-base italic text-parchment/65" data-testid="verify-step">
        {STEPS[stepIdx]}
      </p>

      <div className="mt-4 h-2 w-full max-w-[260px] overflow-hidden rounded-[2px] border-[1.5px] border-gold/30 bg-forest-mid/80">
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="block h-1.5 w-1.5 rounded-full bg-gold"
            style={{ animation: `dotBounce 1.4s ${i * 0.15}s infinite`, opacity: 0.3 }}
          />
        ))}
      </div>

      <style>{`
        @keyframes dotBounce { 0%,100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        @keyframes scan { 0%, 100% { top: 0; } 50% { top: calc(100% - 2px); } }
      `}</style>
    </main>
  );
}

function Photo({ url, label, delay }: { url: string | null; label: string; delay: string }) {
  return (
    <div className="relative h-[108px] w-[108px] overflow-hidden rounded-[3px] border-[1.5px] border-gold/40">
      {url && <img src={url} alt={label} className="h-full w-full object-cover" />}
      <div className="absolute left-0 right-0 top-0 h-0.5 bg-gold" style={{ animation: `scan 1.4s ${delay} linear infinite`, boxShadow: '0 0 10px var(--gold)' }} />
      <div className="absolute bottom-0 left-0 right-0 bg-[rgba(10,18,8,0.85)] py-0.5 text-center font-display text-[9px] font-extrabold uppercase tracking-[0.2em] text-gold">
        {label}
      </div>
    </div>
  );
}

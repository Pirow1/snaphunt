import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { useViewTransition } from '../hooks/useViewTransition';
import { Button } from '../components/ui/Button';
import { playSuccessArpeggio, playFailDescend, vibrate } from '../lib/audio';
import { ForestBg } from '../components/ui/ForestBg';
import type { Submission } from '../lib/types';

export default function ResultScreen() {
  const submissionId = useStore((s) => s.currentSubmissionId);
  const round = useStore((s) => s.currentRound);
  const setCurrentSubmissionId = useStore((s) => s.setCurrentSubmissionId);
  const go = useViewTransition();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [seekerUrl, setSeekerUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!submissionId) return;
    (async () => {
      const { data } = await supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle();
      if (!cancelled) setSubmission(data as Submission | null);
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  const playedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!submission || submission.status !== 'verified') return;
    if (playedFor.current === submission.id) return;
    playedFor.current = submission.id;
    if (submission.is_match === true) {
      playSuccessArpeggio();
      vibrate(200);
    } else {
      playFailDescend();
      vibrate([50, 30, 50]);
    }
  }, [submission?.id, submission?.status, submission?.is_match]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (round?.photo_path) {
        const { data } = await supabase.storage.from('round-photos').createSignedUrl(round.photo_path, 600);
        if (!cancelled) setTargetUrl(data?.signedUrl ?? null);
      }
      if (submission?.photo_path) {
        const { data } = await supabase.storage.from('submission-photos').createSignedUrl(submission.photo_path, 600);
        if (!cancelled) setSeekerUrl(data?.signedUrl ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [round?.photo_path, submission?.photo_path]);

  if (!submission) {
    return (
      <main className="grid h-full place-items-center bg-forest-dark font-mono text-xs uppercase tracking-[0.25em] text-parchment/68">
        loading verdict…
      </main>
    );
  }

  const isMatch = submission.is_match === true;
  const similarityPct =
    submission.cloud_similarity ??
    (submission.local_similarity !== null ? Math.round(submission.local_similarity * 100) : null);
  const subtitle =
    submission.decision_source === 'local_high'
      ? 'Decided Locally · ~200ms'
      : submission.decision_source === 'local_low'
        ? 'Rejected Locally · No API Call'
        : 'Verified by Claude';

  const bannerBg = isMatch
    ? 'bg-[rgba(20,58,20,0.9)]'
    : 'bg-[rgba(90,28,14,0.9)]';

  return (
    <main className="relative isolate flex h-full w-full flex-col bg-forest-dark text-parchment" data-testid="result">
      <ForestBg />
      <div className={`px-[22px] pb-4 pt-7 text-center ${bannerBg}`}>
        <div
          className="font-display text-[56px] font-extrabold uppercase leading-[0.85] tracking-[-0.04em] font-squeeze text-parchment"
          data-testid="result-status"
        >
          {isMatch ? 'A Match!' : 'No Match'}
        </div>
        {similarityPct !== null && (
          <div className="mt-2 font-mono text-[12px] tracking-[0.15em] text-gold opacity-80" data-testid="result-sim">
            Similarity · {similarityPct}%
          </div>
        )}
        {isMatch && round?.point_value && (
          <div className="mt-3.5 inline-block rotate-[-3deg] rounded-[2px] bg-gold px-[18px] py-2 font-display text-[20px] font-extrabold text-forest-dark">
            +{round.point_value}
          </div>
        )}
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80 text-gold" data-testid="result-subtitle">
          {subtitle}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-[22px] py-5">
        <div className="grid grid-cols-2 gap-2.5">
          {[{ url: targetUrl, label: 'Target' }, { url: seekerUrl, label: 'Yours' }].map((cell) => (
            <div key={cell.label} className="relative aspect-square overflow-hidden rounded-[3px] border border-gold/25">
              {cell.url ? (
                <img src={cell.url} alt={cell.label} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-forest-mid/50 font-mono text-[10px] text-parchment/40">
                  {cell.label === 'Yours' ? '(not uploaded)' : '…'}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-[rgba(10,18,8,0.85)] py-0.5 text-center font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
                {cell.label}
              </div>
            </div>
          ))}
        </div>

        {submission.cloud_reasoning && (
          <div className="relative rounded-[3px] border border-gold/25 bg-forest-mid/50 p-4">
            <span className="absolute -top-2.5 left-3.5 rounded-[2px] bg-gold px-2 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-[0.2em] text-forest-dark">
              AI Verdict
            </span>
            <p className="font-serif text-[14px] italic leading-snug text-parchment-2">&ldquo;{submission.cloud_reasoning}&rdquo;</p>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <Button variant="primary" onClick={() => { setCurrentSubmissionId(null); go('/'); }} data-testid="result-home">
            Back to Home
          </Button>
        </div>
      </div>
    </main>
  );
}

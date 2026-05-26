// Matches snaphunt.html #screen-result — banner with MATCH/NO MATCH +
// similarity + points, side-by-side photos, AI verdict quote, action buttons.
// Subtitle reads "DECIDED LOCALLY" / "REJECTED LOCALLY · NO API CALL" /
// "VERIFIED BY CLAUDE" per submission.decision_source.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { useViewTransition } from '../hooks/useViewTransition';
import { Button } from '../components/ui/Button';
import { playSuccessArpeggio, playFailDescend, vibrate } from '../lib/audio';
import type { Submission } from '../lib/types';

export default function ResultScreen() {
  const submissionId = useStore((s) => s.currentSubmissionId);
  const round = useStore((s) => s.currentRound);
  const setCurrentSubmissionId = useStore((s) => s.setCurrentSubmissionId);
  const go = useViewTransition();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [seekerUrl, setSeekerUrl] = useState<string | null>(null);

  // Load this seeker's submission (don't trust local store snapshot — Cloud
  // branch may not have populated cloud_* fields yet at the moment of nav).
  useEffect(() => {
    let cancelled = false;
    if (!submissionId) return;
    (async () => {
      const { data } = await supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle();
      if (!cancelled) setSubmission(data as Submission | null);
    })();
    return () => { cancelled = true; };
  }, [submissionId]);

  // Fire success/fail audio + haptic exactly once per submission as soon as
  // we have its verdict. Re-mounting on /game route changes is fine — the
  // ref scopes "once per submissionId".
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

  // Signed URLs for both photos.
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
      <main className="grid h-full place-items-center bg-cream font-mono text-xs uppercase tracking-[0.25em] text-ink-soft">
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

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink" data-testid="result">
      <div className={`px-[22px] pb-4 pt-7 text-center ${isMatch ? 'bg-forest text-cream' : 'bg-blaze text-cream'}`}>
        <div
          className="font-display text-[60px] font-extrabold uppercase leading-[0.85] tracking-[-0.04em] font-squeeze"
          data-testid="result-status"
        >
          {isMatch ? 'A Match!' : 'No Match'}
        </div>
        {similarityPct !== null && (
          <div className="mt-2 font-mono text-[13px] tracking-[0.15em] opacity-85" data-testid="result-sim">
            Similarity · {similarityPct}%
          </div>
        )}
        {isMatch && round?.point_value && (
          <div className="mt-3.5 inline-block border-2 border-ink bg-gold px-[18px] py-2 font-display text-[22px] font-extrabold text-ink shadow-brutal">
            +{round.point_value}
          </div>
        )}
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80" data-testid="result-subtitle">
          {subtitle}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-[22px] py-5">
        <div className="grid grid-cols-2 gap-2.5">
          {[{ url: targetUrl, label: 'Target' }, { url: seekerUrl, label: 'Yours' }].map((cell) => (
            <div key={cell.label} className="relative aspect-square overflow-hidden border-2 border-ink">
              {cell.url ? (
                <img src={cell.url} alt={cell.label} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-cream-2 font-mono text-[10px] text-ink-soft">
                  {cell.label === 'Yours' ? '(not uploaded)' : '…'}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-ink py-0.5 text-center font-display text-[10px] font-extrabold uppercase tracking-[0.15em] text-cream">
                {cell.label}
              </div>
            </div>
          ))}
        </div>

        {submission.cloud_reasoning && (
          <div className="relative border-2 border-ink bg-cream-2 p-4">
            <span className="absolute -top-2.5 left-3.5 bg-ink px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.15em] text-cream">
              AI Verdict
            </span>
            <p className="font-serif text-[15px] italic leading-snug">&ldquo;{submission.cloud_reasoning}&rdquo;</p>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2">
          {isMatch ? (
            <Button variant="primary" onClick={() => { setCurrentSubmissionId(null); go('/'); }} data-testid="result-home">
              Back to Home
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setCurrentSubmissionId(null)} data-testid="result-keep-hunting">
              Keep Hunting
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

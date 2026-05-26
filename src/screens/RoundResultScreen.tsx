// Between-rounds reveal shown to EVERY player for ~6s when round.status
// flips to 'finished'. Replaces the silent 5s pause from Phase 3.2 where
// non-submitters had no idea why the screen wasn't advancing.
//
// Shows: winner emoji+name (or "Time's Up" if expired), target vs winning
// photo, points-awarded breakdown (base × speed × assists), live standings.
// GameRouter renders this for everyone — the host's auto-advance to the
// next round / WinnerReveal still fires after ROUND_END_PAUSE_MS.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import type { Submission } from '../lib/types';

export default function RoundResultScreen() {
  const round = useStore((s) => s.currentRound);
  const players = useStore((s) => s.players);
  const session = useStore((s) => s.session);
  const authUserId = useStore((s) => s.identity.authUserId);

  const [winningSubmission, setWinningSubmission] = useState<Submission | null>(null);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [foundUrl, setFoundUrl] = useState<string | null>(null);

  const winner = useMemo(
    () => (round?.winner_id ? players.find((p) => p.id === round.winner_id) ?? null : null),
    [players, round?.winner_id],
  );
  const hider = useMemo(
    () => (round?.hider_id ? players.find((p) => p.id === round.hider_id) ?? null : null),
    [players, round?.hider_id],
  );

  // Pull the winning submission to surface its points breakdown.
  useEffect(() => {
    let cancelled = false;
    if (!round?.id || !round.winner_id) { setWinningSubmission(null); return; }
    (async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('round_id', round.id)
        .eq('seeker_id', round.winner_id)
        .eq('is_match', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setWinningSubmission(data as Submission | null);
    })();
    return () => { cancelled = true; };
  }, [round?.id, round?.winner_id]);

  // Signed URLs for target + winning photo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (round?.photo_path) {
        const { data } = await supabase.storage.from('round-photos').createSignedUrl(round.photo_path, 600);
        if (!cancelled) setTargetUrl(data?.signedUrl ?? null);
      }
      if (winningSubmission?.photo_path) {
        const { data } = await supabase.storage.from('submission-photos').createSignedUrl(winningSubmission.photo_path, 600);
        if (!cancelled) setFoundUrl(data?.signedUrl ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [round?.photo_path, winningSubmission?.photo_path]);

  // Cosmetic 6→0 countdown; the real advance is host-driven in GameRouter.
  const [secondsLeft, setSecondsLeft] = useState(6);
  useEffect(() => {
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1_000);
    return () => window.clearInterval(t);
  }, []);

  const ranked = useMemo(
    () => players.slice().sort((a, b) => b.score - a.score),
    [players],
  );

  const isLastRound =
    !!session && !!round && round.round_number >= session.settings.rounds_total;

  if (!round) return null;

  const youAreWinner = winner?.id === authUserId;
  const winnerLabel = winner ? (youAreWinner ? 'You' : winner.name) : null;

  // Points-awarded breakdown. We recompute the multipliers client-side ONLY
  // for display; the authoritative awarded value is whatever the RPC wrote.
  const breakdown = useMemo(() => {
    if (!winningSubmission || !round.point_value || !round.started_at || !round.expires_at) return null;
    const base = round.point_value;
    const startedMs = Date.parse(round.started_at);
    const endedMs = round.ended_at ? Date.parse(round.ended_at) : Date.parse(winningSubmission.verified_at ?? new Date().toISOString());
    const durationS = Math.max(1, (Date.parse(round.expires_at) - startedMs) / 1000);
    const elapsedS = Math.max(0, (endedMs - startedMs) / 1000);
    const speed = Math.max(0.4, 1 - elapsedS / durationS);
    const assists =
      (winningSubmission.hint_used ? 0.85 : 1) *
      Math.pow(0.95, winningSubmission.sharpen_level ?? 0);
    return { base, speed, assists, awarded: winningSubmission.points_awarded ?? 0 };
  }, [winningSubmission, round.point_value, round.started_at, round.expires_at, round.ended_at]);

  return (
    <main className="flex h-full w-full flex-col bg-ink text-cream" data-testid="round-result">
      <div className={`px-6 pt-6 pb-4 text-center ${winner ? 'bg-forest' : 'bg-plum'}`}>
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] opacity-70">
          Round {round.round_number} {winner ? 'Result' : 'Expired'}
        </div>
        <div
          className="mt-2 font-display text-[44px] font-extrabold uppercase leading-[0.9] tracking-[-0.04em] font-squeeze"
          data-testid="round-result-headline"
        >
          {winner ? (
            <>
              {winner.emoji} {winnerLabel} Won!
            </>
          ) : (
            <>⏰ Time's Up</>
          )}
        </div>
        {!winner && hider && (
          <p className="mt-2 font-serif text-[15px] italic opacity-85">
            Nobody found {hider.emoji} {hider.id === authUserId ? 'your' : `${hider.name}'s`} trap.
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-2 gap-2.5">
          <PhotoCell url={targetUrl} label="Target" />
          <PhotoCell url={foundUrl} label="Found" placeholder={winner ? '…' : '(no match)'} />
        </div>

        {breakdown && (
          <div className="border-2 border-cream bg-ink-soft p-3 text-center" data-testid="round-result-breakdown">
            <div className="font-display text-[12px] font-extrabold uppercase tracking-[0.2em] text-gold">
              Points Awarded
            </div>
            <div className="mt-1 font-display text-[36px] font-extrabold text-gold">
              +{breakdown.awarded}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] opacity-70">
              {breakdown.base} × {breakdown.speed.toFixed(2)} speed × {breakdown.assists.toFixed(2)} assists
            </div>
          </div>
        )}

        <div className="border-2 border-cream bg-ink-soft px-3 py-2.5">
          <div className="mb-1.5 font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">
            ★ Standings ★
          </div>
          <ul data-testid="round-result-standings">
            {ranked.map((p, i) => {
              const isYou = p.id === authUserId;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 border-b border-dashed border-cream/20 py-1.5 last:border-b-0"
                  data-testid="round-result-rank"
                  data-rank={i + 1}
                >
                  <span className="font-mono text-[11px] opacity-50">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`flex-1 font-display text-[13px] ${isYou ? 'text-gold font-bold' : ''}`}>
                    {p.emoji} {isYou ? 'You' : p.name}
                  </span>
                  <span className="font-mono text-[12px] font-bold text-gold">{p.score}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-auto text-center font-mono text-[10px] uppercase tracking-[0.25em] opacity-50">
          {isLastRound ? 'Wrapping up…' : `Next round in ${secondsLeft}…`}
        </div>
      </div>
    </main>
  );
}

function PhotoCell({ url, label, placeholder = '…' }: { url: string | null; label: string; placeholder?: string }) {
  return (
    <div className="relative aspect-square overflow-hidden border-2 border-cream">
      {url ? (
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-ink-soft font-mono text-[10px] uppercase tracking-[0.18em] text-cream/60">
          {placeholder}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-cream py-0.5 text-center font-display text-[9px] font-extrabold uppercase tracking-[0.15em] text-ink">
        {label}
      </div>
    </div>
  );
}

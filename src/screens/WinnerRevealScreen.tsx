// End-of-game champion reveal — `/game/:sessionId/winner`.
// Shown before GalleryScreen so the round-recap doesn't bury the win
// at the bottom of a scroll. Co-champion handling: any players sharing
// the max score are all listed on the gold card.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { ForestBg } from '../components/ui/ForestBg';
import { playSuccessArpeggio, vibrate } from '../lib/audio';
import type { Player, Session } from '../lib/types';

export default function WinnerRevealScreen() {
  const { sessionId = null } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  // Use the store's session/players if already hydrated (common case —
  // we arrived here straight from GameRouter); otherwise fetch fresh
  // (deep link / refresh after game end).
  const storeSession = useStore((s) => s.session);
  const storePlayers = useStore((s) => s.players);
  const authUserId = useStore((s) => s.identity.authUserId);

  const [session, setSession] = useState<Session | null>(
    storeSession?.id === sessionId ? storeSession : null,
  );
  const [players, setPlayers] = useState<Player[]>(
    storeSession?.id === sessionId ? storePlayers : [],
  );

  useEffect(() => {
    if (!sessionId || (session && players.length > 0)) return;
    let cancelled = false;
    (async () => {
      const [{ data: sRow }, { data: pRows }] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
        supabase.from('players').select('*').eq('session_id', sessionId).order('joined_at'),
      ]);
      if (cancelled) return;
      if (sRow) setSession(sRow as Session);
      setPlayers((pRows ?? []) as Player[]);
    })();
    return () => { cancelled = true; };
  }, [sessionId, session, players.length]);

  const { champions, allPlayedZero } = useMemo(() => {
    if (players.length === 0) return { champions: [] as Player[], allPlayedZero: false };
    const maxScore = Math.max(...players.map((p) => p.score));
    const champions = players.filter((p) => p.score === maxScore);
    return { champions, allPlayedZero: maxScore === 0 };
  }, [players]);

  // Fire celebratory sound exactly once.
  const [celebrated, setCelebrated] = useState(false);
  useEffect(() => {
    if (celebrated || champions.length === 0) return;
    setCelebrated(true);
    playSuccessArpeggio();
    vibrate([80, 40, 80, 40, 200]);
  }, [celebrated, champions.length]);

  if (!sessionId || !session) {
    return (
      <main className="grid h-full place-items-center bg-forest-dark font-mono text-xs uppercase tracking-[0.25em] text-parchment/68">
        Tallying scores…
      </main>
    );
  }

  const youAreChampion = champions.some((p) => p.id === authUserId);
  const isTie = champions.length > 1;

  return (
    <main
      className="relative isolate flex h-full w-full flex-col items-center justify-between bg-forest-dark px-6 py-10 text-parchment"
      data-testid="winner-reveal"
    >
      <ForestBg />
      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-parchment/65">
          Hunt Complete
        </div>

        <div className="mb-3 font-display text-[14px] font-extrabold uppercase tracking-[0.25em] text-gold">
          {allPlayedZero ? '✦ No Champion ✦' : isTie ? '★ Co-Champions ★' : '★ Champion ★'}
        </div>

        {allPlayedZero ? (
          <div className="rounded-[3px] border-[3px] border-gold bg-forest-mid/80 px-8 py-7 shadow-brutal-gold">
            <p className="font-serif text-lg italic text-parchment/80">
              Nobody scored. Try again?
            </p>
          </div>
        ) : (
          <div
            className="rounded-[3px] border-[3px] border-gold bg-forest-mid/80 px-8 py-7 shadow-brutal-gold"
            data-testid="winner-card"
          >
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-4">
              {champions.map((c) => {
                const isYou = c.id === authUserId;
                return (
                  <div
                    key={c.id}
                    className="flex flex-col items-center"
                    data-testid="winner-entry"
                    data-you={isYou ? 'true' : 'false'}
                  >
                    <span className="text-[64px] leading-none">{c.emoji}</span>
                    <span className="mt-2 font-display text-[26px] font-extrabold uppercase leading-none tracking-[-0.02em] text-gold font-squeeze">
                      {isYou ? 'You' : c.name}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 font-mono text-[11px] uppercase tracking-[0.25em] text-parchment/72">
              {isTie ? 'tied at' : ''} {champions[0]!.score} pts
            </div>
          </div>
        )}

        {!allPlayedZero && (
          <p className="mt-6 max-w-[28ch] font-serif text-base italic text-parchment/80">
            {youAreChampion
              ? isTie
                ? 'A shared throne. Worthy hunters all.'
                : 'You hunted with intent. The crown is yours.'
              : isTie
                ? 'The hunters split the spoils.'
                : `${champions[0]!.name} hunted hardest.`}
          </p>
        )}
      </div>

      <div className="relative z-[1] w-full max-w-[320px]">
        <Button
          variant="primary"
          onClick={() => navigate(`/gallery/${sessionId}`)}
          data-testid="winner-see-recap"
        >
          See Recap →
        </Button>
      </div>
    </main>
  );
}

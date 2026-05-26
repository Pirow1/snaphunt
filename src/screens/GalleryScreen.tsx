import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import type { Player, Round, Submission } from '../lib/types';
import { Button } from '../components/ui/Button';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { ForestBg } from '../components/ui/ForestBg';

type Loaded = {
  players: Player[];
  rounds: Round[];
  winningSubmissions: Map<string, Submission>;
};

export default function GalleryScreen() {
  const { sessionId = null } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const authUserId = useStore((s) => s.identity.authUserId);
  const setSession = useStore((s) => s.setSession);
  const setPlayers = useStore((s) => s.setPlayers);
  const setCurrentRound = useStore((s) => s.setCurrentRound);
  const setCurrentSubmissionId = useStore((s) => s.setCurrentSubmissionId);
  const clearSubmissions = useStore((s) => s.clearSubmissions);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const [{ data: ps }, { data: rs }] = await Promise.all([
        supabase.from('players').select('*').eq('session_id', sessionId).order('joined_at'),
        supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_number'),
      ]);
      if (cancelled) return;
      const rounds = (rs ?? []) as Round[];
      const players = (ps ?? []) as Player[];

      const winningSubmissions = new Map<string, Submission>();
      await Promise.all(
        rounds.map(async (r) => {
          if (!r.winner_id) return;
          const { data: sub } = await supabase
            .from('submissions')
            .select('*')
            .eq('round_id', r.id)
            .eq('seeker_id', r.winner_id)
            .eq('is_match', true)
            .maybeSingle();
          if (sub) winningSubmissions.set(r.id, sub as Submission);
        }),
      );
      if (cancelled) return;
      setLoaded({ players, rounds, winningSubmissions });

      const urls: Record<string, string> = {};
      await Promise.all(
        rounds.map(async (r) => {
          if (r.photo_path) {
            const { data } = await supabase.storage.from('round-photos').createSignedUrl(r.photo_path, 600);
            if (data?.signedUrl) urls[`target:${r.id}`] = data.signedUrl;
          }
          const sub = winningSubmissions.get(r.id);
          if (sub?.photo_path) {
            const { data } = await supabase.storage.from('submission-photos').createSignedUrl(sub.photo_path, 600);
            if (data?.signedUrl) urls[`found:${r.id}`] = data.signedUrl;
          }
        }),
      );
      if (cancelled) return;
      setPhotoUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const ranked = useMemo(() => {
    if (!loaded) return [];
    return loaded.players.slice().sort((a, b) => b.score - a.score);
  }, [loaded]);

  const handlePlayAgain = () => {
    setSession(null);
    setPlayers([]);
    setCurrentRound(null);
    setCurrentSubmissionId(null);
    clearSubmissions();
    navigate('/');
  };

  return (
    <main className="relative isolate flex min-h-full w-full flex-col bg-forest-dark text-parchment" data-testid="gallery">
      <ForestBg />
      <TopBar title="Hunt Recap" right={<TopBarBadge>Final</TopBarBadge>} />

      <div className="px-[18px] py-5">
        <div className="text-center">
          <h2 className="font-display text-[38px] font-extrabold uppercase leading-[0.9] tracking-[-0.04em] font-squeeze text-parchment">
            The
            <br />
            Souvenirs
          </h2>
          <p className="mt-2 font-serif text-base italic text-parchment/75">every match, every miss</p>
        </div>

        <div className="mt-5 flex flex-col gap-3.5" data-testid="recap-list">
          {!loaded ? (
            <div className="rounded-[3px] border border-gold/15 bg-forest-mid/40 px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/58">
              Loading recap…
            </div>
          ) : loaded.rounds.length === 0 ? (
            <div className="rounded-[3px] border border-gold/15 bg-forest-mid/40 px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/58">
              No rounds were played.
            </div>
          ) : (
            loaded.rounds.map((r) => {
              const hider = loaded.players.find((p) => p.id === r.hider_id);
              const hiderName = hider?.id === authUserId ? 'You' : (hider?.name ?? '—');
              const sub = loaded.winningSubmissions.get(r.id);
              const isMatch = !!sub;
              const isLegendary = r.difficulty === 'legendary' && isMatch;
              const verdictText = isLegendary ? 'Legendary' : isMatch ? 'Match' : 'No Match';
              const verdictBg = isLegendary
                ? 'bg-gold text-forest-dark'
                : isMatch
                  ? 'bg-ember text-parchment'
                  : 'bg-forest-mid/80 text-parchment/70';
              const source = sub?.decision_source;
              const sourceStamp = source === 'cloud' ? 'Claude' : source ? 'Local' : null;
              return (
                <article
                  key={r.id}
                  className="rounded-[4px] border border-gold/20 bg-forest-mid/40 p-3.5"
                  data-testid="recap-card"
                  data-round-number={r.round_number}
                  data-match={isMatch ? 'true' : 'false'}
                  data-source={source ?? 'none'}
                >
                  <header className="mb-2.5 flex items-center justify-between">
                    <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.1em] text-parchment">
                      Round {String(r.round_number).padStart(2, '0')} · {hiderName} hid
                    </span>
                    <span
                      className={`rotate-[-2deg] rounded-[2px] border border-gold/25 px-2 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.18em] ${verdictBg}`}
                      data-testid="recap-stamp"
                    >
                      {verdictText}
                    </span>
                  </header>

                  <div className="grid grid-cols-2 gap-1.5">
                    <PhotoCell url={photoUrls[`target:${r.id}`]} label="Target" />
                    <PhotoCell url={photoUrls[`found:${r.id}`]} label={isMatch ? 'Found' : 'Miss'} placeholder={isMatch ? null : '(nobody matched)'} />
                  </div>

                  {sub?.cloud_reasoning && (
                    <p className="mt-2.5 font-serif text-[13px] italic leading-snug text-parchment/80">
                      &ldquo;{sub.cloud_reasoning}&rdquo;
                    </p>
                  )}

                  {sourceStamp && (
                    <div className="mt-2 flex justify-end">
                      <span
                        className={`rounded-[2px] border border-gold/25 px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-[0.18em] ${source === 'cloud' ? 'bg-plum text-parchment' : 'bg-forest-mid text-parchment/70'}`}
                        data-testid="recap-source"
                      >
                        {sourceStamp}
                      </span>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 bg-[rgba(10,18,8,0.7)] px-4 py-4 text-parchment">
        <div className="mb-2 font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-gold">
          ★ Final Standings ★
        </div>
        <ul data-testid="scoreboard">
          {ranked.map((p, i) => {
            const isYou = p.id === authUserId;
            return (
              <li
                key={p.id}
                className="flex items-center gap-2.5 border-b border-gold/10 py-2 last:border-b-0"
                data-testid="scoreboard-row"
                data-rank={i + 1}
                data-you={isYou ? 'true' : 'false'}
              >
                <span className="font-mono text-[12px] text-parchment/50">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={`flex-1 font-display text-[14px] font-bold ${isYou ? 'text-gold' : 'text-parchment'}`}>
                  {isYou ? 'You ' : ''}{p.emoji} {isYou ? '' : p.name}
                </span>
                <span className="font-mono text-[13px] font-bold text-gold">{p.score} pts</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-[18px] py-5">
        <Button variant="primary" onClick={handlePlayAgain} data-testid="play-again">
          Play Again →
        </Button>
      </div>
    </main>
  );
}

function PhotoCell({ url, label, placeholder = null }: { url?: string; label: string; placeholder?: string | null }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-[3px] border border-gold/20">
      {url ? (
        <img src={url} alt={label} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-forest-mid/50 font-mono text-[10px] uppercase tracking-[0.18em] text-parchment/58">
          {placeholder ?? '…'}
        </div>
      )}
      <span className="absolute right-1.5 top-1.5 rounded-[2px] bg-[rgba(10,18,8,0.85)] px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-[0.15em] text-gold">
        {label}
      </span>
    </div>
  );
}

import { useMemo } from 'react';
import { useStore } from '../../lib/store';

/**
 * Top-3 cumulative scores + your rank if outside the top 3.
 * Reads `players` from the store (kept live by `useSession`).
 */
export function MiniLeaderboard() {
  const players = useStore((s) => s.players);
  const authUserId = useStore((s) => s.identity.authUserId);

  const { top3, you } = useMemo(() => {
    const sorted = players.slice().sort((a, b) => b.score - a.score);
    const top3 = sorted.slice(0, 3);
    const youIdx = sorted.findIndex((p) => p.id === authUserId);
    const inTop3 = top3.some((p) => p.id === authUserId);
    const you =
      youIdx >= 0 && !inTop3
        ? { rank: youIdx + 1, score: sorted[youIdx]!.score }
        : null;
    return { top3, you };
  }, [players, authUserId]);

  if (top3.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto border-2 border-ink bg-ink px-2 py-1.5 text-cream"
      data-testid="mini-leaderboard"
    >
      <span className="shrink-0 font-display text-[9px] font-extrabold uppercase tracking-[0.2em] text-gold">
        ★
      </span>
      {top3.map((p, i) => {
        const isYou = p.id === authUserId;
        return (
          <span
            key={p.id}
            className={`flex shrink-0 items-center gap-1 font-mono text-[11px] ${isYou ? 'text-gold font-bold' : 'opacity-80'}`}
            data-testid="mini-leaderboard-row"
            data-rank={i + 1}
            data-you={isYou ? 'true' : 'false'}
          >
            <span className="opacity-60">{i + 1}.</span>
            <span>{p.emoji}</span>
            <span className="max-w-[60px] truncate">{isYou ? 'You' : p.name}</span>
            <span className="font-bold">{p.score}</span>
          </span>
        );
      })}
      {you && (
        <span
          className="ml-auto flex shrink-0 items-center gap-1 border-l border-cream/30 pl-2 font-mono text-[11px] font-bold text-gold"
          data-testid="mini-leaderboard-you"
        >
          <span className="opacity-60">#{you.rank}</span>
          <span>You</span>
          <span>{you.score}</span>
        </span>
      )}
    </div>
  );
}

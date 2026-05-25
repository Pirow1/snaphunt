import type { Player } from '../../lib/types';

type PlayerRowProps = {
  player: Player;
  /** Mark the local player's row (`(You)` suffix). */
  isSelf?: boolean;
  /** Optional: animate the gold→cream-2 flash when newly arrived. */
  isNew?: boolean;
};

// Matches snaphunt.html .player-row — 36px circular avatar with border, name
// at flex-1, uppercase badge on the right. Slides in from the left on mount.
export function PlayerRow({ player, isSelf = false, isNew = false }: PlayerRowProps) {
  const badge = player.is_host ? 'Host' : 'Joined';
  const badgeBg = player.is_host ? 'bg-gold' : 'bg-cream-2';
  const avatarBg = player.is_host ? 'bg-gold' : 'bg-cream-2';

  return (
    <div
      className={[
        'flex items-center gap-3 border-2 border-ink px-3.5 py-3',
        'animate-slide-in',
        isNew ? 'animate-new-pulse' : 'bg-cream-2',
      ].join(' ')}
    >
      <div
        className={`${avatarBg} flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink text-lg`}
        aria-hidden="true"
      >
        {player.emoji}
      </div>
      <div className="flex-1 truncate font-display text-[15px] font-bold">
        {player.name}
        {isSelf && <span className="ml-1.5 font-mono text-[10px] text-ink-soft">(you)</span>}
      </div>
      <span
        className={`${badgeBg} border-[1.5px] border-ink px-2 py-[3px] font-display text-[10px] font-extrabold uppercase tracking-[0.15em]`}
      >
        {badge}
      </span>
    </div>
  );
}

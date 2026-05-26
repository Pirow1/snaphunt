import type { Player } from '../../lib/types';

type PlayerRowProps = {
  player: Player;
  isSelf?: boolean;
  isNew?: boolean;
};

export function PlayerRow({ player, isSelf = false, isNew = false }: PlayerRowProps) {
  const badge = player.is_host ? 'Host' : 'Joined';

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-[3px] border border-gold/20 px-3.5 py-3',
        'animate-slide-in',
        isNew ? 'animate-new-pulse' : 'bg-forest-mid/60',
      ].join(' ')}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-gold/35 bg-[rgba(10,18,8,0.5)] text-lg"
        aria-hidden="true"
      >
        {player.emoji}
      </div>
      <div className="flex-1 truncate font-display text-[14px] font-bold text-parchment">
        {player.name}
        {isSelf && <span className="ml-1.5 font-mono text-[10px] text-parchment/50">(you)</span>}
      </div>
      <span className="rounded-[2px] border border-gold/35 bg-gold/15 px-2 py-[3px] font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-gold">
        {badge}
      </span>
    </div>
  );
}

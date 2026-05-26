import type { ReactNode } from 'react';
import { useViewTransition } from '../../hooks/useViewTransition';

type TopBarProps = {
  title: string;
  back?: string;
  right?: ReactNode;
};

export function TopBar({ title, back, right }: TopBarProps) {
  const go = useViewTransition();
  return (
    <div className="flex items-center justify-between border-b border-gold/[0.18] bg-[rgba(10,18,8,0.6)] px-[22px] py-[18px] pb-3 backdrop-blur-md">
      {back ? (
        <button
          type="button"
          aria-label="Back"
          onClick={() => go(back)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px] border-gold/35 bg-forest-mid/60 font-display text-xl font-extrabold text-gold active:bg-gold active:text-forest-dark"
        >
          ←
        </button>
      ) : (
        <span className="block h-[38px] w-[38px]" />
      )}
      <div className="font-display text-[14px] font-extrabold uppercase tracking-[0.12em] text-parchment">{title}</div>
      {right ?? <span className="block h-[26px] w-[44px]" />}
    </div>
  );
}

export function TopBarBadge({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'gold' }) {
  const cls =
    tone === 'gold'
      ? 'bg-gold/15 border border-gold/35 text-gold'
      : 'bg-gold/15 border border-gold/35 text-gold';
  return (
    <span className={`${cls} rounded-[2px] px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.15em]`}>
      {children}
    </span>
  );
}

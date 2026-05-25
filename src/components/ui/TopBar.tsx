import type { ReactNode } from 'react';
import { useViewTransition } from '../../hooks/useViewTransition';

type TopBarProps = {
  title: string;
  back?: string;
  right?: ReactNode;
};

// Matches snaphunt.html .topbar — circular ← back left, uppercase title centre,
// optional inverted "Host" / "Guest" badge right, dashed-bottom border.
export function TopBar({ title, back, right }: TopBarProps) {
  const go = useViewTransition();
  return (
    <div className="flex items-center justify-between border-b-2 border-dashed border-ink px-[22px] py-[18px] pb-3">
      {back ? (
        <button
          type="button"
          aria-label="Back"
          onClick={() => go(back)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-xl font-extrabold active:bg-ink active:text-cream"
        >
          ←
        </button>
      ) : (
        <span className="block h-[38px] w-[38px]" />
      )}
      <div className="font-display text-[15px] font-extrabold uppercase tracking-[0.1em]">{title}</div>
      {right ?? <span className="block h-[26px] w-[44px]" />}
    </div>
  );
}

export function TopBarBadge({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'gold' }) {
  const cls =
    tone === 'gold'
      ? 'bg-gold text-ink'
      : 'bg-ink text-cream';
  return (
    <span className={`${cls} px-2.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.15em]`}>
      {children}
    </span>
  );
}

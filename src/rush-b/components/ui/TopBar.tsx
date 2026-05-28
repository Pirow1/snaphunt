import type { ReactNode } from 'react';
import { useViewTransition } from '../../hooks/useViewTransition';

type TopBarProps = { title: string; back?: string; right?: ReactNode };

export function TopBar({ title, back, right }: TopBarProps) {
  const go = useViewTransition();
  return (
    <div className="flex items-center justify-between border-b-2 border-rim bg-carbon/90 px-[22px] py-3 backdrop-blur-md">
      {back ? (
        <button
          type="button"
          aria-label="Back"
          onClick={() => go(back)}
          className="flex h-9 w-9 items-center justify-center rounded-[2px] border border-rim bg-surface font-rb-mono text-[18px] text-smoke active:bg-spark active:text-void"
        >
          ←
        </button>
      ) : (
        <span className="block h-9 w-9" />
      )}
      <div className="font-rb-display text-[18px] tracking-[0.1em] text-chalk">{title}</div>
      {right ?? <span className="block h-7 w-[44px]" />}
    </div>
  );
}

export function TopBarBadge({ children, tone = 'yellow' }: { children: ReactNode; tone?: 'yellow' | 'red' | 'green' }) {
  const cls = {
    yellow: 'border-spark/60 text-spark bg-spark/10',
    red:    'border-threat/60 text-threat bg-threat/10',
    green:  'border-clear/60 text-clear bg-clear/10',
  }[tone];
  return (
    <span className={`${cls} rounded-[2px] border px-2.5 py-1 font-rb-mono text-[11px] uppercase tracking-[0.12em]`}>
      {children}
    </span>
  );
}

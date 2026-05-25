import { useParams } from 'react-router-dom';
import { useViewTransition } from '../hooks/useViewTransition';

type PlaceholderProps = {
  label: string;
  next?: { to: string; label: string };
};

export function Placeholder({ label, next }: PlaceholderProps) {
  const params = useParams();
  const go = useViewTransition();
  return (
    <main className="flex h-full w-full flex-col items-start gap-6 bg-cream px-8 pt-20 pb-12 text-ink">
      <span className="font-mono text-xs tracking-[0.3em] text-ink/50">
        SCREEN · {label.toUpperCase()}
      </span>
      <h1 className="font-display text-5xl font-extrabold leading-none font-squeeze">
        {label}
      </h1>
      {Object.keys(params).length > 0 && (
        <pre className="font-mono text-xs text-ink/60">
          {JSON.stringify(params, null, 2)}
        </pre>
      )}

      <div className="mt-auto flex w-full flex-col gap-3">
        {next && (
          <button
            type="button"
            onClick={() => go(next.to)}
            className="w-full border-2 border-ink bg-gold py-3 font-display text-base font-bold uppercase tracking-wider shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)]"
          >
            → {next.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => go('/')}
          className="w-full border-2 border-ink bg-cream-2 py-3 font-display text-base font-bold uppercase tracking-wider shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)]"
        >
          ← Home
        </button>
      </div>
    </main>
  );
}

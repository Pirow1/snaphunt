import { useViewTransition } from '../hooks/useViewTransition';

export default function HomeScreen() {
  const go = useViewTransition();
  return (
    <main className="flex h-full w-full flex-col items-center justify-between bg-cream px-8 pt-20 pb-12 text-ink">
      <header className="flex w-full flex-col items-start gap-2">
        <span className="font-mono text-xs tracking-[0.3em] text-ink/60">EST. NOW</span>
        <h1
          className="font-display text-7xl font-extrabold leading-[0.85] font-squeeze"
          style={{ viewTransitionName: 'app-title' }}
        >
          SNAP
          <span className="block -mt-2 rotate-[-3deg] text-blaze">HUNT</span>
        </h1>
        <p className="mt-4 max-w-[20ch] font-serif italic text-lg text-ink/80">
          Photographic hide &amp; seek. Race friends to find what you found.
        </p>
      </header>

      <div className="flex w-full flex-col gap-4">
        <button
          type="button"
          onClick={() => go('/create')}
          className="w-full border-2 border-ink bg-blaze py-4 font-display text-xl font-bold uppercase tracking-wider text-cream shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)]"
        >
          Start a Hunt
        </button>
        <button
          type="button"
          onClick={() => go('/join')}
          className="w-full border-2 border-ink bg-cream-2 py-4 font-display text-xl font-bold uppercase tracking-wider text-ink shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)]"
        >
          Join a Hunt
        </button>
      </div>

      <footer className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/40">
        v0.0.1 · scaffold
      </footer>
    </main>
  );
}

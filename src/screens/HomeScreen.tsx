import { useViewTransition } from '../hooks/useViewTransition';
import { Button } from '../components/ui/Button';
import { CrosshairBg } from '../components/ui/CrosshairBg';

// Matches snaphunt.html #screen-home — topbar, crosshair hero, blaze rotated
// HUNT accent, italic Fraunces tagline, two CTAs, dashed-top meta footer.
//
// initVision is fired from App.tsx so it pre-warms regardless of which
// route a user lands on first (e.g. a deep-linked /join/<code>).
export default function HomeScreen() {
  const go = useViewTransition();

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <div className="flex items-center justify-between px-[22px] pt-[18px] pb-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-blaze">
          ▲ v0.3 prototype
        </span>
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">
          est. 2026
        </span>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center py-10 text-center">
        <CrosshairBg />
        <h1
          className="relative mb-2 font-display text-[clamp(60px,16vw,88px)] font-extrabold leading-[0.85] tracking-[-0.06em] font-squeeze"
          style={{ viewTransitionName: 'app-title' }}
        >
          SNAP
          <br />
          <span className="inline-block rotate-[-3deg] text-blaze">HUNT</span>
          <span className="absolute -bottom-2 left-[20%] block h-[6px] w-[60%] bg-ink" aria-hidden="true" />
        </h1>
        <p className="mt-6 font-serif text-[17px] italic text-ink-soft">
          photographic <span className="mx-2 text-blaze">✦</span> hide &amp; seek
        </p>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-7">
        <Button variant="primary" onClick={() => go('/create')}>
          <span>▶ Start a Hunt</span>
        </Button>
        <Button variant="dark" onClick={() => go('/join')}>
          ◉ Join with Code
        </Button>
      </div>

      <div className="flex items-center justify-between border-t-2 border-dashed border-ink px-[22px] pt-3.5 pb-2 font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
        <span>3 friends min.</span>
        <span>·</span>
        <span>outdoors recommended</span>
      </div>
    </main>
  );
}

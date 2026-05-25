// Matches snaphunt.html #screen-role — full-screen ink background, centred
// role card, 3px-bordered "★ ASSIGNMENT ★" stamp with scale-from-3x animation,
// huge wdth-70 role title (blaze HIDER / gold SEEKER), italic Fraunces blurb,
// gold "Accept Mission" CTA.

import { useViewTransition } from '../hooks/useViewTransition';
import { Button } from '../components/ui/Button';

type RoleRevealProps = {
  role: 'hider' | 'seeker';
  hiderName?: string | null;
  onAccept: () => void;
};

const COPY = {
  hider: 'Find an object. Photograph it. Hope no one finds it before time runs out.',
  seeker: 'Race to find what the hider photographed. Match it through the lens, first.',
} as const;

export default function RoleRevealScreen({ role, hiderName, onAccept }: RoleRevealProps) {
  const go = useViewTransition();

  // The View Transition has nothing to do with React Router on this screen
  // (we don't change routes); the stamp animation runs on mount via the
  // `animate-stamp-in` utility. We expose go() only for the "Back" affordance.
  void go;

  const titleColor = role === 'hider' ? 'text-blaze' : 'text-gold';

  return (
    <main className="flex h-full w-full flex-col items-center justify-center bg-ink px-6 text-cream">
      <div className="w-[88%] max-w-[340px] text-center">
        <div
          className="mb-7 inline-block animate-stamp-in border-[3px] border-cream px-[18px] py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.2em]"
          style={{ viewTransitionName: 'role-stamp' }}
          data-testid="role-stamp"
        >
          ★ Assignment ★
        </div>

        <h1
          className={`mb-3 font-display text-[clamp(80px,22vw,110px)] font-extrabold uppercase leading-[0.8] tracking-[-0.06em] font-squeeze ${titleColor}`}
          data-testid="role-title"
        >
          {role}
        </h1>

        <p className="mx-auto mb-7 mt-4 max-w-[28ch] font-serif text-[19px] italic leading-snug text-cream-3">
          {COPY[role]}
        </p>

        {role === 'seeker' && hiderName && (
          <p className="mb-7 font-mono text-[11px] uppercase tracking-[0.25em] text-cream-3/60">
            Hider this round · <span className="text-gold">{hiderName}</span>
          </p>
        )}

        <div className="mx-auto max-w-[260px]">
          <Button variant="gold" onClick={onAccept} data-testid="accept-mission">
            Accept Mission
          </Button>
        </div>
      </div>
    </main>
  );
}

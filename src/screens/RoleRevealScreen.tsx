import { useViewTransition } from '../hooks/useViewTransition';
import { Button } from '../components/ui/Button';
import { ForestBg } from '../components/ui/ForestBg';

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
  void go;

  const titleColor = role === 'hider' ? 'text-ember' : 'text-gold';

  return (
    <main className="relative isolate flex h-full w-full flex-col items-center justify-center bg-forest-dark px-6 text-parchment">
      <ForestBg />
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(200,168,75,0.12) 0%, transparent 70%)', zIndex: 0 }} aria-hidden="true" />

      <div className="relative z-[1] w-[88%] max-w-[340px] text-center">
        <div
          className="mb-7 inline-block animate-stamp-in rounded-[2px] border-2 border-gold px-[18px] py-2 font-display text-[12px] font-extrabold uppercase tracking-[0.2em] text-gold"
          style={{ viewTransitionName: 'role-stamp' }}
          data-testid="role-stamp"
        >
          ★ Assignment ★
        </div>

        <h1
          className={`mb-3 font-display font-extrabold uppercase leading-[0.8] tracking-[-0.06em] font-squeeze ${titleColor}`}
          style={{ fontSize: 'clamp(80px, 22vw, 110px)' }}
          data-testid="role-title"
        >
          {role}
        </h1>

        <p className="mx-auto mb-7 mt-4 max-w-[28ch] font-serif text-[18px] italic leading-snug text-parchment/82">
          {COPY[role]}
        </p>

        {role === 'seeker' && hiderName && (
          <p className="mb-7 font-mono text-[11px] uppercase tracking-[0.25em] text-parchment/75">
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

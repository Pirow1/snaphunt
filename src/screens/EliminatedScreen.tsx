import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function EliminatedScreen() {
  const navigate = useNavigate();

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 bg-forest-dark px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-6xl">💀</span>
        <h1 className="font-display text-[28px] font-extrabold uppercase tracking-[0.12em] text-ember">
          Eliminated
        </h1>
        <p className="font-serif text-[15px] italic leading-relaxed text-parchment/60">
          You fell into too many traps.<br />
          The hunt goes on without you.
        </p>
      </div>

      <div className="h-px w-20 bg-gold/25" />

      <div className="flex flex-col items-center gap-2">
        <p className="font-display text-[11px] uppercase tracking-[0.2em] text-parchment/30">
          Better luck next time
        </p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="text-[22px] opacity-20 grayscale">❤️</span>
          ))}
        </div>
      </div>

      <Button
        variant="dark"
        onClick={() => navigate('/')}
        className="mt-4 w-full max-w-xs"
      >
        Back to Home
      </Button>
    </main>
  );
}

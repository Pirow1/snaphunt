import { useCountdown } from '../../hooks/useCountdown';

type BombTimerProps = {
  expiresAt: string | null;
  onExpired?: () => void;
};

export function BombTimer({ expiresAt, onExpired }: BombTimerProps) {
  const { text, secondsLeft, isExpired } = useCountdown(expiresAt);

  const urgent = secondsLeft <= 30 && !isExpired;
  const critical = secondsLeft <= 10 && !isExpired;

  // Notify parent once on expiry
  if (isExpired && onExpired) {
    // parent handles idempotency
  }

  return (
    <div className={`relative overflow-hidden rounded-[2px] border-2 ${isExpired ? 'border-threat/40 bg-threat/5' : urgent ? 'border-threat bg-threat/10' : 'border-rim bg-surface'}`}>
      {/* Warning stripe header */}
      <div className="warning-stripe h-[6px] w-full" />

      <div className="px-4 py-3 text-center">
        <div className="font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-1">
          {isExpired ? '— DETONATED —' : '⏱ BOMB DETONATES IN'}
        </div>
        <div
          className={`font-rb-mono text-[52px] leading-none tabular-nums ${
            isExpired
              ? 'text-threat/40'
              : critical
              ? 'text-threat animate-danger-pulse'
              : urgent
              ? 'text-threat'
              : 'text-spark'
          }`}
        >
          {text}
        </div>
      </div>

      {/* Warning stripe footer */}
      <div className="warning-stripe h-[6px] w-full" />
    </div>
  );
}

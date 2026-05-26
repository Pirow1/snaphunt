import { useEffect } from 'react';
import { useStore } from '../../lib/store';

const TOAST_TTL_MS = 2200;

export function ToastHost() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const current = toasts[toasts.length - 1] ?? null;

  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => dismissToast(current.id), TOAST_TTL_MS);
    return () => window.clearTimeout(t);
  }, [current, dismissToast]);

  if (!current) return null;
  const borderTone =
    current.tone === 'error' ? 'border-ember' : 'border-gold/40';

  return (
    <div
      className={`pointer-events-none fixed bottom-[30px] left-1/2 z-[200] -translate-x-1/2 rounded-[3px] border-[1.5px] ${borderTone} bg-[rgba(10,18,8,0.95)] px-[18px] py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.1em] text-parchment backdrop-blur-md`}
      role="status"
      aria-live="polite"
      data-testid="toast"
    >
      {current.text}
    </div>
  );
}

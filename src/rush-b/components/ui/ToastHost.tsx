import { useEffect } from 'react';
import { useStore } from '../../lib/store';

const TOAST_TTL_MS = 2500;

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
  const border = current.tone === 'error' ? 'border-threat' : current.tone === 'success' ? 'border-clear' : 'border-spark/50';

  return (
    <div
      className={`pointer-events-none fixed bottom-[30px] left-1/2 z-[200] -translate-x-1/2 rounded-[2px] border-2 ${border} bg-carbon/95 px-4 py-2.5 font-rb-display text-[16px] tracking-[0.08em] text-chalk backdrop-blur-md`}
      role="status"
      aria-live="polite"
    >
      {current.text}
    </div>
  );
}

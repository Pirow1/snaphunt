// App-root toast host. Renders the latest message from store.toasts as a
// fixed bottom pill (ink bg, gold border) matching snaphunt.html .toast.
// Auto-dismisses each toast after ~2.2s.

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
    current.tone === 'error' ? 'border-blaze' : current.tone === 'success' ? 'border-gold' : 'border-gold';

  return (
    <div
      className={`pointer-events-none fixed bottom-[30px] left-1/2 z-[200] -translate-x-1/2 border-2 ${borderTone} bg-ink px-[18px] py-2.5 font-display text-[13px] font-bold uppercase tracking-[0.1em] text-cream shadow-brutal`}
      role="status"
      aria-live="polite"
      data-testid="toast"
    >
      {current.text}
    </div>
  );
}

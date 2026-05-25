import { useEffect, useState } from 'react';

export type Countdown = {
  text: string;
  secondsLeft: number;
  isExpired: boolean;
};

export function useCountdown(expiresAt: string | null): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [expiresAt]);

  if (!expiresAt) return { text: '--:--', secondsLeft: 0, isExpired: false };

  const ms = new Date(expiresAt).getTime() - now;
  const secondsLeft = Math.max(0, Math.ceil(ms / 1000));
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const ss = (secondsLeft % 60).toString().padStart(2, '0');
  return { text: `${mm}:${ss}`, secondsLeft, isExpired: ms <= 0 };
}

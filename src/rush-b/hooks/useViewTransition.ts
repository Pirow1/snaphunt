import { useNavigate, type NavigateOptions } from 'react-router-dom';

/**
 * Pillar 2 — wraps navigate() in document.startViewTransition() when supported,
 * otherwise falls back to a plain navigation. Browsers without the API still
 * route correctly; they just don't morph.
 */
export function useViewTransition() {
  const navigate = useNavigate();
  return (to: string, options?: NavigateOptions): void => {
    if (typeof document.startViewTransition !== 'function') {
      navigate(to, options);
      return;
    }
    document.startViewTransition(() => {
      navigate(to, options);
    });
  };
}

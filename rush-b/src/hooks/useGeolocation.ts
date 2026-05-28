import { useEffect } from 'react';
import { useStore } from '../lib/store';
import type { GeoCoords } from '../lib/geolocation';

export type UseGeolocationResult = {
  coords: GeoCoords | null;
  error: string | null;
};

/**
 * Lives-on-the-store watchPosition wrapper. The seeker screen uses this to
 * keep coords fresh (high accuracy, max age 2s). The store-backed value
 * means the BearingArrow component (and anything else) doesn't trigger its
 * own watch — there's only ever one active watch per page.
 */
export function useGeolocation(): UseGeolocationResult {
  const coords = useStore((s) => s.coords);
  const setCoords = useStore((s) => s.setCoords);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      // Silent on errors at the hook level — the UI surfaces a notice if
      // coords stay null. The user already saw the permission dialog.
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [setCoords]);

  return { coords, error: null };
}

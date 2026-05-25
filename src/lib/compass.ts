// Pillar 4 — cross-platform compass.
//
// iOS:     reads `event.webkitCompassHeading` (clockwise from true north,
//          0=N/90=E/180=S/270=W). Requires a one-time user-gesture call to
//          DeviceOrientationEvent.requestPermission() (added in iOS 13).
// Android: reads `event.alpha` on the `deviceorientationabsolute` event when
//          available. Android's alpha is counter-clockwise from north, so we
//          flip to clockwise via 360 - alpha.
// Desktop: usually has no orientation hardware; the listener attaches but
//          rarely fires. Smoke tests dispatch synthetic events to verify the
//          math.

export type CompassHandler = (headingDeg: number) => void;

type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

let permissionGranted = false;

export function isPermissionGranted(): boolean {
  return permissionGranted;
}

/**
 * iOS requires this to be called inside a user-gesture handler. Returns true
 * when the platform doesn't need an explicit grant (Android/desktop) or when
 * the user said yes.
 */
export async function requestCompassPermission(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') {
    permissionGranted = false;
    return false;
  }
  const ctor = DeviceOrientationEvent as DeviceOrientationEventCtor;
  if (typeof ctor.requestPermission === 'function') {
    try {
      const result = await ctor.requestPermission();
      permissionGranted = result === 'granted';
      return permissionGranted;
    } catch {
      permissionGranted = false;
      return false;
    }
  }
  // Android / desktop — no explicit prompt
  permissionGranted = true;
  return true;
}

/**
 * Attaches a listener for the compass. Returns an unsubscribe function.
 * The handler is invoked with a heading in degrees clockwise from north
 * (0=N, 90=E, 180=S, 270=W).
 */
export function subscribeCompass(handler: CompassHandler): () => void {
  if (typeof window === 'undefined') return () => {};

  const listener = (e: DeviceOrientationEvent) => {
    let heading: number | null = null;

    // iOS-specific: webkitCompassHeading is already clockwise from true north.
    const webkitHeading = e.webkitCompassHeading;
    if (typeof webkitHeading === 'number' && !Number.isNaN(webkitHeading)) {
      heading = webkitHeading;
    } else if (e.absolute && typeof e.alpha === 'number') {
      // Android `absolute` orientation: alpha is counter-clockwise from north.
      heading = 360 - e.alpha;
    }

    if (heading !== null) {
      handler(((heading % 360) + 360) % 360);
    }
  };

  const supportsAbsolute = 'ondeviceorientationabsolute' in window;
  const eventName = supportsAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(eventName, listener as EventListener);
  return () => window.removeEventListener(eventName, listener as EventListener);
}

/**
 * Geodesic bearing from (lat1, lng1) to (lat2, lng2), in degrees clockwise
 * from north.
 */
export function bearingTo(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

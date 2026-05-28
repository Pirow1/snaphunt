// Pillar 4 — rotates an SVG triangle to point at (targetLat, targetLng).
//
// arrowAngle = geodesicBearing(me → target) − deviceHeading
//
// A 200ms ease on transform smooths magnetometer jitter without making the
// arrow feel laggy.

import { useCompass } from '../../hooks/useCompass';
import { useGeolocation } from '../../hooks/useGeolocation';
import { bearingTo } from '../../lib/compass';

type BearingArrowProps = {
  targetLat: number;
  targetLng: number;
  /** Tailwind classes for the SVG container; size, colour, etc. */
  className?: string;
  /** Optional fixed-bearing override for tests / preview pages. */
  fixedBearing?: number;
  /** Optional fixed-heading override for tests / preview pages. */
  fixedHeading?: number;
};

export function BearingArrow({ targetLat, targetLng, className = '', fixedBearing, fixedHeading }: BearingArrowProps) {
  const { heading: liveHeading } = useCompass();
  const { coords } = useGeolocation();

  const heading = fixedHeading ?? liveHeading;
  const bearing =
    fixedBearing ??
    (coords ? bearingTo(coords.lat, coords.lng, targetLat, targetLng) : null);

  if (heading === null || bearing === null) {
    return null;
  }
  const arrowAngle = ((bearing - heading) % 360 + 360) % 360;

  return (
    <div
      className={className}
      style={{
        transform: `rotate(${arrowAngle}deg)`,
        transition: 'transform 200ms ease',
      }}
      data-testid="bearing-arrow"
      data-angle={arrowAngle.toFixed(2)}
    >
      <svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
        {/* Tall triangle pointing up (north when arrowAngle=0) */}
        <path d="M12 0 L24 28 L12 22 L0 28 Z" fill="currentColor" />
      </svg>
    </div>
  );
}

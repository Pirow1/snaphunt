// Dev-only diagnostic page for Pillar 4. Hardcoded target = Big Ben.
//
// On iOS: tap "Enable compass" first (gesture), then heading should populate.
// On Android: heading auto-populates if the device has an absolute magnetometer.
// On desktop: heading stays null; smoke tests dispatch synthetic events to
// verify the math.

import { useEffect, useState } from 'react';
import { TopBar } from '../components/ui/TopBar';
import { BearingArrow } from '../components/game/BearingArrow';
import { useCompass } from '../hooks/useCompass';
import { useGeolocation } from '../hooks/useGeolocation';
import { bearingTo } from '../lib/compass';

const TARGET = { name: 'Big Ben', lat: 51.5007, lng: -0.1246 };

export default function CompassTestScreen() {
  const { heading, requestPerm } = useCompass();
  const { coords } = useGeolocation();
  const [permState, setPermState] = useState<'unknown' | 'granted' | 'denied' | 'na'>('unknown');

  useEffect(() => {
    // On Android / desktop the API doesn't need a gesture, so reflect that.
    if (typeof DeviceOrientationEvent === 'undefined') {
      setPermState('na');
      return;
    }
    const ctor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof ctor.requestPermission !== 'function') setPermState('granted');
  }, []);

  const bearing = coords ? bearingTo(coords.lat, coords.lng, TARGET.lat, TARGET.lng) : null;
  const arrowAngle =
    bearing !== null && heading !== null
      ? ((bearing - heading) % 360 + 360) % 360
      : null;

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <TopBar title="Compass Test" back="/" />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-[22px] py-5">
        <section className="grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-[0.15em]">
          <div className="border-2 border-ink bg-cream-2 p-3">
            <div className="text-ink-soft">heading</div>
            <div
              className="mt-1 font-mono text-2xl font-bold lowercase tracking-normal"
              data-testid="heading"
            >
              {heading === null ? '—' : `${heading.toFixed(1)}°`}
            </div>
          </div>
          <div className="border-2 border-ink bg-cream-2 p-3">
            <div className="text-ink-soft">bearing</div>
            <div
              className="mt-1 font-mono text-2xl font-bold lowercase tracking-normal"
              data-testid="bearing"
            >
              {bearing === null ? '—' : `${bearing.toFixed(1)}°`}
            </div>
          </div>
        </section>

        <section className="border-2 border-ink bg-cream-2 p-4 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
            target · {TARGET.name}
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-soft">
            {TARGET.lat.toFixed(4)}, {TARGET.lng.toFixed(4)}
          </div>
        </section>

        {/* Arrow */}
        <section className="grid place-items-center border-2 border-ink bg-ink py-10">
          <div className="relative h-32 w-32">
            <BearingArrow
              targetLat={TARGET.lat}
              targetLng={TARGET.lng}
              className="absolute inset-0 mx-auto h-full w-full text-blaze"
            />
            {/* Crosshair behind for orientation */}
            <span aria-hidden="true" className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cream/15" />
            <span aria-hidden="true" className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-cream/15" />
          </div>
          <div
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-cream-3"
            data-testid="arrow-angle"
          >
            arrow {arrowAngle === null ? '—' : `${arrowAngle.toFixed(1)}°`}
          </div>
        </section>

        {/* Permission button — iOS-only flow */}
        <section className="text-center">
          {permState !== 'granted' && permState !== 'na' && (
            <button
              type="button"
              onClick={async () => {
                const ok = await requestPerm();
                setPermState(ok ? 'granted' : 'denied');
              }}
              className="rounded-[2px] border-2 border-ink bg-gold px-[22px] py-[14px] font-display text-[15px] font-bold uppercase tracking-tight shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)]"
              data-testid="enable-compass"
            >
              Enable Compass
            </button>
          )}
          {permState === 'granted' && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              compass · auto-enabled
            </p>
          )}
          {permState === 'denied' && (
            <p className="font-display text-xs font-bold uppercase tracking-[0.15em] text-blaze">
              permission denied — enable in OS settings
            </p>
          )}
          {permState === 'na' && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              compass · not available on this device
            </p>
          )}
        </section>

        <div className="mt-auto font-mono text-[10px] text-ink-soft">
          DEV-only · arrowAngle = (bearing − heading + 360) mod 360 · spec §11.6
        </div>
      </div>
    </main>
  );
}

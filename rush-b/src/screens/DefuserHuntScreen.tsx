import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useStore } from '../lib/store';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCompass } from '../hooks/useCompass';
import { useCountdown } from '../hooks/useCountdown';
import { supabase } from '../lib/supabase';
import { haversine } from '../lib/geolocation';
import { getHeartbeatBand, playHeartbeatPulse, getRadarBand, playRadarPing } from '../lib/audio';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { BombTimer } from '../components/game/BombTimer';
import { BombCard } from '../components/game/BombCard';
import { Radar } from '../components/game/Radar';
import { PhotoCapture } from '../components/game/PhotoCapture';

type Props = { onBombExploded: () => void };

export default function DefuserHuntScreen({ onBombExploded }: Props) {
  const round = useStore((s) => s.currentRound);
  const session = useStore((s) => s.session);
  const authUserId = useStore((s) => s.identity.authUserId);
  const identity = useStore((s) => s.identity);
  const submitGuess = useStore((s) => s.submitGuess);
  const setLastTrackedDistance = useStore((s) => s.setLastTrackedDistance);

  const { coords } = useGeolocation();
  const { heading, requestPerm } = useCompass();
  const [compassNeedsPerm, setCompassNeedsPerm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sharpenLevel, setSharpenLevel] = useState<0 | 1 | 2 | 3>(0);
  const [pingFlash, setPingFlash] = useState(false);

  // Warning level derived from time remaining
  const { secondsLeft } = useCountdown(round?.expires_at ?? null);
  const warningLevel =
    secondsLeft <= 10 ? 'extreme' :
    secondsLeft <= 30 ? 'critical' :
    secondsLeft <= 60 ? 'warning' : 'normal';

  const distance = useMemo(() => {
    if (!coords || !round?.planter_lat || !round?.planter_lng) return null;
    return haversine(coords, { lat: round.planter_lat, lng: round.planter_lng, accuracy: 0 });
  }, [coords, round?.planter_lat, round?.planter_lng]);

  // Compass permission prompt
  useEffect(() => {
    const ctor = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
    if (typeof ctor.requestPermission === 'function' && heading === null) setCompassNeedsPerm(true);
  }, [heading]);

  // Presence tracking
  const presenceRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!session || !authUserId) return;
    const ch = supabase.channel(`presence:session:${session.id}`, { config: { presence: { key: authUserId } } });
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') presenceRef.current = ch; });
    return () => { supabase.removeChannel(ch); presenceRef.current = null; };
  }, [session?.id, authUserId]);

  useEffect(() => {
    const ch = presenceRef.current;
    if (!ch || distance === null) return;
    const rounded = Math.round(distance);
    ch.track({ player_id: authUserId, name: identity.name, emoji: identity.emoji, distance_meters: rounded })
      .then(() => setLastTrackedDistance(rounded)).catch(() => {});
  }, [distance, authUserId, identity.name, identity.emoji, setLastTrackedDistance]);

  // Radar pings (20–100m): intermittent sonar chirps for direction finding
  const radarBand = distance !== null ? getRadarBand(distance) : null;
  const radarIntervalMs = radarBand?.intervalMs ?? null;
  useEffect(() => {
    if (!radarIntervalMs || !radarBand) return;
    const { volume } = radarBand;
    const fire = () => {
      playRadarPing(volume);
      setPingFlash(true);
      setTimeout(() => setPingFlash(false), 350);
    };
    fire();
    const id = setInterval(fire, radarIntervalMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarIntervalMs]);

  // Digital heartbeat beeps (<20m): rapid proximity alarm
  const heartbeatBand = distance !== null ? getHeartbeatBand(distance) : null;
  const heartbeatIntervalMs = heartbeatBand?.intervalMs ?? null;
  useEffect(() => {
    if (!heartbeatIntervalMs || !heartbeatBand) return;
    const { volume } = heartbeatBand;
    playHeartbeatPulse(volume);
    const id = setInterval(() => playHeartbeatPulse(volume), heartbeatIntervalMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heartbeatIntervalMs]);

  const handleExpired = useCallback(() => { onBombExploded(); }, [onBombExploded]);

  if (!round) return null;

  // Warning overlay styles
  const flashStyles: Record<string, React.CSSProperties> = {
    warning:  { animation: 'screen-flash-warning  2.0s ease-in-out infinite' },
    critical: { animation: 'screen-flash-critical  1.0s ease-in-out infinite' },
    extreme:  { animation: 'screen-flash-extreme   0.4s ease-in-out infinite' },
  };

  return (
    <main className="relative flex h-full w-full flex-col bg-void text-smoke overflow-hidden">
      {/* Screen-edge warning glow — intensifies with each level */}
      {warningLevel !== 'normal' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-40"
          style={{
            boxShadow: 'inset 0 0 60px rgba(255,32,32,0.35)',
            animation: 'edge-glow-pulse 1.2s ease-in-out infinite',
            animationDuration: warningLevel === 'extreme' ? '0.35s' : warningLevel === 'critical' ? '0.7s' : '1.4s',
          }}
        />
      )}

      {/* Red flash overlay */}
      {(warningLevel === 'critical' || warningLevel === 'extreme') && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 bg-threat/12"
          style={flashStyles[warningLevel]}
        />
      )}

      {/* Warning-stripe header that blinks at critical */}
      <div
        className="warning-stripe h-[6px] w-full flex-shrink-0"
        style={warningLevel === 'critical' || warningLevel === 'extreme'
          ? { animation: `warning-stripe-blink ${warningLevel === 'extreme' ? '0.3s' : '0.6s'} step-end infinite` }
          : undefined}
      />

      <TopBar title="Hunt The Bomb" right={<TopBarBadge tone="yellow">Defuser</TopBarBadge>} />

      <div className="flex flex-1 flex-col gap-3 px-5 pt-3 pb-5 overflow-y-auto">
        <BombTimer expiresAt={round.expires_at} onExpired={handleExpired} />

        <BombCard photoPath={round.photo_path} sharpenLevel={sharpenLevel} />

        {compassNeedsPerm && (
          <button
            type="button"
            onClick={async () => { const ok = await requestPerm(); if (ok) setCompassNeedsPerm(false); }}
            className="rounded-[2px] border-2 border-spark/60 bg-spark/10 py-2.5 font-mono text-[11px] uppercase tracking-[0.15em] text-spark active:scale-[0.98]"
          >
            ↻ Enable Compass
          </button>
        )}

        {round.planter_lat !== null && round.planter_lng !== null ? (
          <Radar
            distanceMeters={distance}
            accuracyMeters={coords?.accuracy ?? null}
            targetLat={round.planter_lat}
            targetLng={round.planter_lng}
            pingFlash={pingFlash}
          />
        ) : (
          <div className="grid h-36 place-items-center rounded-[2px] border border-rim bg-surface font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            awaiting bomb plant…
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-auto">
          {/* Sharpen */}
          <button
            type="button"
            disabled={sharpenLevel >= 3}
            onClick={() => setSharpenLevel((Math.min(3, sharpenLevel + 1)) as 0 | 1 | 2 | 3)}
            className="flex flex-col items-center justify-center gap-1 rounded-[2px] border border-rim bg-surface px-2 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-smoke active:bg-spark/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-[18px]">🔍</span>
            <span>Enhance</span>
            <span className="text-[9px] text-ash">{sharpenLevel < 3 ? `${3 - sharpenLevel} left` : 'maxed'}</span>
          </button>

          {/* Capture */}
          <PhotoCapture
            ariaLabel="Submit defusal attempt"
            onCapture={async (f) => {
              if (submitting) return;
              setSubmitError(null);
              setSubmitting(true);
              try {
                await submitGuess({ file: f });
              } catch (e) {
                setSubmitError(e instanceof Error ? e.message : 'Submit failed');
                setSubmitting(false);
              }
            }}
            buttonProps={{
              className: 'flex items-center justify-center gap-2 rounded-[2px] border-none bg-threat px-4 py-3 font-display text-[16px] text-chalk transition-[background,transform] active:scale-[0.97] disabled:opacity-40',
              disabled: submitting,
            }}
          >
            💣 {submitting ? 'Submitting…' : 'Defuse!'}
          </PhotoCapture>

          {submitError && (
            <div className="col-span-2 rounded-[2px] border border-threat/50 bg-threat/10 px-3 py-2 font-mono text-[11px] text-threat">
              {submitError}
            </div>
          )}
        </div>
      </div>

      {/* Warning-stripe footer that blinks at critical */}
      <div
        className="warning-stripe h-[6px] w-full flex-shrink-0"
        style={warningLevel === 'critical' || warningLevel === 'extreme'
          ? { animation: `warning-stripe-blink ${warningLevel === 'extreme' ? '0.3s' : '0.6s'} step-end infinite` }
          : undefined}
      />
    </main>
  );
}

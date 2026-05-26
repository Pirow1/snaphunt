// Matches snaphunt.html #screen-seeker — TargetCard up top, Radar in the
// middle, action row at the bottom (USE HINT / SHARPEN minis + a full-width
// SUBMIT FINDING shutter button). Distance broadcasts over Realtime Presence
// (never raw coords) so the hider can see how close everyone is.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useStore } from '../lib/store';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCompass } from '../hooks/useCompass';
import { supabase } from '../lib/supabase';
import { haversine } from '../lib/geolocation';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { TargetCard } from '../components/game/TargetCard';
import { Radar } from '../components/game/Radar';
import { PhotoCapture } from '../components/game/PhotoCapture';
import { MiniLeaderboard } from '../components/game/MiniLeaderboard';

export default function SeekerHuntScreen() {
  const round = useStore((s) => s.currentRound);
  const session = useStore((s) => s.session);
  const authUserId = useStore((s) => s.identity.authUserId);
  const identity = useStore((s) => s.identity);
  const { coords } = useGeolocation();
  const { heading, requestPerm } = useCompass();

  const submitGuess = useStore((s) => s.submitGuess);
  const sharpenLevel = useStore((s) => s.sharpenLevel);
  const setSharpenLevel = useStore((s) => s.setSharpenLevel);
  const hintRevealed = useStore((s) => s.hintUsed);
  const setHintRevealed = useStore((s) => s.setHintUsed);
  const [compassNeedsPerm, setCompassNeedsPerm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Distance: only computable once we have BOTH the hider pin and our coords.
  const distance = useMemo(() => {
    if (!coords || !round?.hider_lat || !round?.hider_lng) return null;
    return haversine(coords, { lat: round.hider_lat, lng: round.hider_lng, accuracy: 0 });
  }, [coords, round?.hider_lat, round?.hider_lng]);

  // iOS-only one-shot "Enable compass" gesture banner.
  useEffect(() => {
    if (typeof DeviceOrientationEvent === 'undefined') return;
    const ctor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof ctor.requestPermission === 'function' && heading === null) {
      setCompassNeedsPerm(true);
    }
  }, [heading]);

  // Presence: broadcast distance (NEVER raw coords) on the session channel.
  const presenceRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!session || !authUserId) return;
    const ch = supabase.channel(`presence:session:${session.id}`, {
      config: { presence: { key: authUserId } },
    });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') presenceRef.current = ch;
    });
    return () => { supabase.removeChannel(ch); presenceRef.current = null; };
  }, [session?.id, authUserId]);

  const setLastTrackedDistance = useStore((s) => s.setLastTrackedDistance);
  useEffect(() => {
    const ch = presenceRef.current;
    if (!ch || distance === null) return;
    const rounded = Math.round(distance);
    ch.track({
      player_id: authUserId,
      name: identity.name,
      emoji: identity.emoji,
      distance_meters: rounded,
    })
      .then(() => setLastTrackedDistance(rounded))
      .catch(() => {});
  }, [distance, authUserId, identity.name, identity.emoji, setLastTrackedDistance]);

  if (!round) return null;

  const hintAvailable = !!round.hint;
  const canSharpen = sharpenLevel < 3;

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <TopBar
        title="Active Hunt"
        right={<TopBarBadge tone="gold">Seeker</TopBarBadge>}
      />

      <div className="flex flex-1 flex-col gap-3.5 px-[22px] pt-3 pb-[22px]">
        <MiniLeaderboard />
        <TargetCard
          photoPath={round.photo_path}
          hint={round.hint}
          pointValue={round.point_value}
          sharpenLevel={sharpenLevel}
          hintRevealed={hintRevealed}
        />

        {compassNeedsPerm && (
          <button
            type="button"
            onClick={async () => {
              const ok = await requestPerm();
              if (ok) setCompassNeedsPerm(false);
            }}
            className="border-2 border-ink bg-gold py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.15em] shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)]"
            data-testid="enable-compass"
          >
            ↻ Enable Compass
          </button>
        )}

        {round.hider_lat !== null && round.hider_lng !== null ? (
          <Radar
            distanceMeters={distance}
            accuracyMeters={coords?.accuracy ?? null}
            targetLat={round.hider_lat}
            targetLng={round.hider_lng}
          />
        ) : (
          <div className="grid h-40 place-items-center border-2 border-ink bg-ink font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
            waiting for hider…
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            disabled={!hintAvailable || hintRevealed}
            onClick={() => setHintRevealed(true)}
            className="flex flex-col items-center justify-center gap-1 border-2 border-ink bg-cream-2 px-2 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_var(--ink)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="use-hint"
          >
            <span className="text-lg">💡</span>
            <span>Use Hint</span>
            <span className="text-[10px] opacity-70">
              {!hintAvailable ? 'unavailable' : hintRevealed ? 'revealed' : '1 left'}
            </span>
          </button>
          <button
            type="button"
            disabled={!canSharpen}
            onClick={() => setSharpenLevel(Math.min(3, sharpenLevel + 1) as 0 | 1 | 2 | 3)}
            className="flex flex-col items-center justify-center gap-1 border-2 border-ink bg-cream-2 px-2 py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] shadow-[3px_3px_0_var(--ink)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="sharpen"
          >
            <span className="text-lg">🔍</span>
            <span>Sharpen</span>
            <span className="text-[10px] opacity-70">
              {canSharpen ? `${3 - sharpenLevel} left` : 'maxed'}
            </span>
          </button>

          <PhotoCapture
            ariaLabel="Submit Finding"
            onCapture={async (f) => {
              if (submitting) return;
              setSubmitError(null);
              setSubmitting(true);
              try {
                await submitGuess({ file: f });
                // GameRouter routes to VerifyingScreen / ResultScreen based on
                // the new currentSubmissionId + submission status.
              } catch (e) {
                setSubmitError(e instanceof Error ? e.message : 'Submit failed');
                setSubmitting(false);
              }
            }}
            buttonProps={{
              className:
                'col-span-2 flex items-center justify-center gap-3 border-2 border-ink bg-blaze px-5 py-[22px] font-display text-[18px] font-extrabold uppercase tracking-[0.1em] text-cream shadow-brutal hover:bg-blaze-deep active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)] disabled:opacity-40',
              'data-testid': 'submit-finding',
              style: { viewTransitionName: 'shutter-btn' },
              disabled: submitting,
            }}
          >
            <span className="relative inline-block h-6 w-6 rounded-full border-[3px] border-cream">
              <span aria-hidden="true" className="absolute inset-[3px] rounded-full bg-cream" />
            </span>
            {submitting ? 'Submitting…' : 'Submit Finding'}
          </PhotoCapture>
          {submitError && (
            <div className="col-span-2 border-2 border-ink bg-blaze px-3 py-2 font-display text-sm font-bold text-cream">
              {submitError}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

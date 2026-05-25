// Matches snaphunt.html #screen-wait.
// "TRAP SET" stamp + floating eye SVG + live seeker tracking from the
// presence channel + countdown until expires_at. Subscribes to incoming
// submissions on the current round and toasts each verifying/escalating
// event with the seeker's emoji + name.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { useCountdown } from '../hooks/useCountdown';
import type { Player } from '../lib/types';

type PresenceMeta = {
  player_id?: string;
  name?: string;
  emoji?: string;
  distance_meters?: number;
};

type Tracked = { id: string; name: string; emoji: string; distance: number };

function tempFor(d: number): { label: string; tone: 'blaze' | 'gold' | 'ink' } {
  if (d < 20) return { label: 'BURNING', tone: 'blaze' };
  if (d < 50) return { label: 'hot', tone: 'blaze' };
  if (d < 120) return { label: 'warm', tone: 'gold' };
  if (d < 300) return { label: 'cold', tone: 'ink' };
  return { label: 'frozen', tone: 'ink' };
}

export default function HiderWaitScreen() {
  const session = useStore((s) => s.session);
  const round = useStore((s) => s.currentRound);
  const authUserId = useStore((s) => s.identity.authUserId);
  const players = useStore((s) => s.players);
  const pushToast = useStore((s) => s.pushToast);
  const submissions = useStore((s) => s.submissions);

  const countdown = useCountdown(round?.expires_at ?? null);
  const [tracked, setTracked] = useState<Tracked[]>([]);

  // Subscribe to the presence channel (same one seekers .track() on) but as a
  // pure listener — no key, no track().
  const presenceRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!session || !authUserId) return;
    const ch = supabase.channel(`presence:session:${session.id}`);
    ch.on('presence', { event: 'sync' }, () => {
      const all = ch.presenceState() as Record<string, PresenceMeta[]>;
      const rows: Tracked[] = [];
      for (const [, metas] of Object.entries(all)) {
        const m = metas[metas.length - 1];
        if (!m?.player_id || m.player_id === authUserId) continue;
        if (typeof m.distance_meters !== 'number') continue;
        rows.push({
          id: m.player_id,
          name: m.name ?? '—',
          emoji: m.emoji ?? '👤',
          distance: m.distance_meters,
        });
      }
      rows.sort((a, b) => a.distance - b.distance);
      setTracked(rows);
    });
    ch.subscribe();
    presenceRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      presenceRef.current = null;
    };
  }, [session?.id, authUserId]);

  // Submission lifecycle → toasts. We read from the store's submissions map
  // (useSession's broadcast listener keeps it fresh) and dedupe by phase.
  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);
  const seenPhases = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!round) return;
    for (const row of Object.values(submissions)) {
      if (row.round_id !== round.id) continue;
      const phase =
        row.status === 'verified'
          ? row.decision_source === 'cloud'
            ? 'cloud-verdict'
            : 'local-verdict'
          : row.photo_path
            ? 'cloud-escalated'
            : 'verifying';
      if (seenPhases.current.get(row.id) === phase) continue;
      seenPhases.current.set(row.id, phase);

      const seeker = playerById.get(row.seeker_id);
      const label = seeker ? `${seeker.emoji} ${seeker.name}` : 'Someone';
      if (phase === 'verifying') pushToast(`${label} is verifying… (local)`, 'info');
      else if (phase === 'cloud-escalated') pushToast(`${label} escalated to cloud`, 'info');
      else if (phase === 'cloud-verdict' || phase === 'local-verdict') {
        pushToast(
          `${label}: ${row.is_match ? 'matched!' : 'no match'}`,
          row.is_match ? 'success' : 'info',
        );
      }
    }
  }, [submissions, round?.id, playerById, pushToast]);

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink" data-testid="hider-wait">
      <TopBar title="Trap Active" right={<TopBarBadge tone="dark">Hider</TopBarBadge>} />

      <div className="px-[22px] py-3 text-center">
        <span
          className="inline-block rotate-[-3deg] bg-blaze px-[18px] py-1.5 font-display text-[12px] font-extrabold uppercase tracking-[0.25em] text-cream shadow-brutal"
          data-testid="trap-stamp"
        >
          Trap Set
        </span>
        <h2 className="mt-3.5 font-display text-[38px] font-extrabold uppercase leading-[0.9] tracking-[-0.04em] font-squeeze">
          Seekers
          <br />
          Are Out There.
        </h2>
        <p className="mt-3 font-serif text-base italic text-ink-soft">
          Watch them squirm <span className="font-display text-blaze">✦</span>{' '}
          <span data-testid="hider-countdown">{countdown.text} left</span>
        </p>
      </div>

      <div className="flex justify-center py-6">
        <div className="h-[180px] w-[180px] animate-wait-float">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <ellipse cx="100" cy="100" rx="90" ry="55" fill="none" stroke="#1A1614" strokeWidth="4" />
            <circle cx="100" cy="100" r="40" fill="#E94F2A" />
            <circle cx="100" cy="100" r="20" fill="#1A1614" />
            <circle cx="92" cy="92" r="6" fill="#F4E8D0" />
            <path
              d="M 30 100 Q 100 50 170 100"
              fill="none"
              stroke="#1A1614"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
        </div>
        <style>{`
          @keyframes wait-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
          .animate-wait-float { animation: wait-float 3s ease-in-out infinite; }
        `}</style>
      </div>

      <div className="flex-1 overflow-y-auto px-[22px] pb-5">
        <span className="block pb-2.5 font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-ink-soft">
          Live Tracking
        </span>
        {tracked.length === 0 ? (
          <div className="border-2 border-dashed border-ink/30 bg-cream-2 px-4 py-5 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
            Waiting for the hunt to begin…
          </div>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="seeker-list">
            {tracked.map((s) => {
              const t = tempFor(s.distance);
              const dotColor = t.tone === 'blaze' ? 'bg-blaze' : t.tone === 'gold' ? 'bg-gold' : 'bg-ink';
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 border-2 border-ink bg-cream-2 px-3.5 py-3.5"
                  data-testid="seeker-row"
                  data-seeker={s.id}
                >
                  <span className={`block h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
                  <span className="font-display text-[15px] font-extrabold">
                    {s.emoji} {s.name}
                  </span>
                  <span className="ml-auto font-mono text-[13px] font-bold">
                    {s.distance}m · {t.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

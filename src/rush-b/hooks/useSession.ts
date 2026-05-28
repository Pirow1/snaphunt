import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import type { Player, Round, Session, Submission } from '../lib/types';

type BroadcastPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: 'players' | 'rounds' | 'sessions' | 'submissions';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

const POLL_FALLBACK_MS = 3_000;

export function useSession(sessionId: string | null): void {
  const setSession = useStore((s) => s.setSession);
  const setPlayers = useStore((s) => s.setPlayers);
  const setCurrentRound = useStore((s) => s.setCurrentRound);
  const upsertSubmission = useStore((s) => s.upsertSubmission);
  const authUserId = useStore((s) => s.identity.authUserId);

  useEffect(() => {
    if (!sessionId || !authUserId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let pollTimer: number | null = null;

    async function snapshot() {
      if (cancelled || !sessionId) return;
      const [{ data: sessionRow }, { data: playerRows }, { data: roundRows }] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
        supabase.from('players').select('*').eq('session_id', sessionId).order('joined_at'),
        supabase.from('rounds').select('*').eq('session_id', sessionId)
          .order('round_number', { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      if (sessionRow) setSession(sessionRow as Session);
      setPlayers((playerRows ?? []) as Player[]);
      setCurrentRound((roundRows?.[0] ?? null) as Round | null);
    }

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session?.access_token) {
        try { supabase.realtime.disconnect(); } catch { /* ok */ }
        supabase.realtime.setAuth(sess.session.access_token);
      }

      await snapshot();
      if (cancelled) return;

      function applyPlayers(p: BroadcastPayload) {
        const state = useStore.getState();
        if (p.eventType === 'DELETE') {
          setPlayers(state.players.filter((pl) => pl.id !== (p.old?.['id'] as string)));
        } else if (p.new) {
          const pl = p.new as Player;
          const exists = state.players.some((x) => x.id === pl.id);
          setPlayers(exists ? state.players.map((x) => (x.id === pl.id ? pl : x)) : [...state.players, pl]);
        }
      }

      channel = supabase.channel(`session:${sessionId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'db_change' }, ({ payload }: { payload: BroadcastPayload }) => {
          if (payload.table === 'sessions' && payload.new) setSession(payload.new as Session);
          if (payload.table === 'players') applyPlayers(payload);
          if (payload.table === 'rounds' && payload.new) setCurrentRound(payload.new as Round);
          if (payload.table === 'submissions' && payload.new) upsertSubmission(payload.new as Submission);
        })
        .subscribe();

      pollTimer = window.setInterval(snapshot, POLL_FALLBACK_MS);
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [sessionId, authUserId, setSession, setPlayers, setCurrentRound, upsertSubmission]);
}

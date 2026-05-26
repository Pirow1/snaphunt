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

/**
 * Subscribes the store to a session's players / rounds / sessions via
 * Supabase Realtime *broadcast* (DB triggers push messages — see
 * 0006_realtime_broadcast_triggers).
 *
 * Channel is `session:<sessionId>` (private); RLS on realtime.messages
 * (0005) gates who may subscribe.
 *
 * Pass `null` to tear down.
 */
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

    (async () => {
      // Pin Realtime's auth to the current access_token so the realtime.messages
      // policy's auth.uid() resolves to this user. setAuth() on an already-open
      // socket doesn't always re-handshake the JWT, so we explicitly disconnect
      // first — the next subscribe forces a reconnect with the new token.
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session?.access_token) {
        try { supabase.realtime.disconnect(); } catch { /* not yet connected */ }
        supabase.realtime.setAuth(sess.session.access_token);
      }

      // Initial fetch (broadcast only carries CDC; we still need a snapshot).
      const [{ data: sessionRow }, { data: playerRows }, { data: roundRows }] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
        supabase.from('players').select('*').eq('session_id', sessionId).order('joined_at'),
        supabase
          .from('rounds')
          .select('*')
          .eq('session_id', sessionId)
          .order('round_number', { ascending: false })
          .limit(1),
      ]);

      if (cancelled) return;
      if (sessionRow) setSession(sessionRow as Session);
      setPlayers((playerRows ?? []) as Player[]);
      setCurrentRound((roundRows?.[0] ?? null) as Round | null);

      function applyPlayers(p: BroadcastPayload) {
        const state = useStore.getState();
        if (p.eventType === 'DELETE') {
          const id = (p.old as { id: string }).id;
          setPlayers(state.players.filter((row) => row.id !== id));
          return;
        }
        const next = p.new as Player;
        const idx = state.players.findIndex((row) => row.id === next.id);
        if (idx === -1) setPlayers([...state.players, next]);
        else {
          const copy = state.players.slice();
          copy[idx] = next;
          setPlayers(copy);
        }
      }

      channel = supabase
        .channel(`session:${sessionId}`, { config: { private: true } })
        .on('broadcast', { event: 'players' }, ({ payload }) => applyPlayers(payload as BroadcastPayload))
        .on('broadcast', { event: 'rounds' }, ({ payload }) => {
          const p = payload as BroadcastPayload;
          if (p.eventType === 'DELETE') return;
          setCurrentRound(p.new as Round);
        })
        .on('broadcast', { event: 'sessions' }, ({ payload }) => {
          const p = payload as BroadcastPayload;
          if (p.new) setSession(p.new as Session);
        })
        .on('broadcast', { event: 'submissions' }, ({ payload }) => {
          const p = payload as BroadcastPayload;
          if (p.eventType === 'DELETE' || !p.new) return;
          upsertSubmission(p.new as Submission);
        })
        .subscribe(async (status, err) => {
          // Log in prod too — without this the only way to diagnose a stuck
          // subscribe on a deployed device is the network ws frame inspector.
          console.log('[rt/subscribe]', status, err?.message ?? '');
          // Race: any INSERT that landed between our initial fetch and the
          // SUBSCRIBED handshake was never delivered (Realtime doesn't queue).
          // Re-fetch once on subscribe to close the window.
          if (status === 'SUBSCRIBED' && !cancelled) {
            const [{ data: sx }, { data: ps }, { data: rs }] = await Promise.all([
              supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle(),
              supabase.from('players').select('*').eq('session_id', sessionId).order('joined_at'),
              supabase.from('rounds').select('*').eq('session_id', sessionId).order('round_number', { ascending: false }).limit(1),
            ]);
            if (!cancelled) {
              if (sx) setSession(sx as Session);
              setPlayers((ps ?? []) as Player[]);
              setCurrentRound((rs?.[0] ?? null) as Round | null);
            }
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId, authUserId, setSession, setPlayers, setCurrentRound, upsertSubmission]);
}

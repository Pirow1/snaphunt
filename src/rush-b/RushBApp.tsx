import { useEffect } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore as useRbStore } from './lib/store';
import { initVision } from './lib/vision';
import { supabase } from '../lib/supabase';
import HomeScreen from './screens/HomeScreen';
import CreateLobbyScreen from './screens/CreateLobbyScreen';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameRouter from './screens/GameRouter';
import WinnerRevealScreen from './screens/WinnerRevealScreen';
import FeatureDemoScreen from './screens/FeatureDemoScreen';
import { ToastHost } from './components/ui/ToastHost';

type Props = { onExit: () => void };

export default function RushBApp({ onExit }: Props) {
  const setAuthUserId = useRbStore((s) => s.setAuthUserId);
  const setVisionLoadProgress = useRbStore((s) => s.setVisionLoadProgress);
  const setVisionReady = useRbStore((s) => s.setVisionReady);

  // Rush B now loads as its own top-level tree (full navigation from the
  // dashboard), so it can't rely on SnapHunt's App having signed in or warmed
  // vision. Bootstrap both here: reuse a cached anon session if present,
  // otherwise create one.
  useEffect(() => {
    initVision((pct) => setVisionLoadProgress(pct))
      .then(() => setVisionReady(true))
      .catch((err) => console.error('[rush-b vision] init failed:', err));
  }, [setVisionLoadProgress, setVisionReady]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        if (!cancelled) setAuthUserId(existing.session.user.id);
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) { console.error('signInAnonymously failed:', error); return; }
      if (!cancelled) setAuthUserId(data.user?.id ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthUserId(s?.user?.id ?? null);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [setAuthUserId]);

  return (
    <MemoryRouter>
      <div
        className="relative flex h-full w-full flex-col overflow-hidden"
        style={{ background: 'var(--void)', color: 'var(--smoke)', fontFamily: '"Rajdhani", system-ui, sans-serif' }}
      >
        <Routes>
          <Route path="/" element={<HomeScreen onBack={onExit} />} />
          <Route path="/create" element={<CreateLobbyScreen />} />
          <Route path="/join" element={<JoinScreen />} />
          <Route path="/join/:code" element={<JoinScreen />} />
          <Route path="/lobby/:sessionId" element={<LobbyScreen />} />
          <Route path="/game/:sessionId" element={<GameRouter />} />
          <Route path="/game/:sessionId/winner" element={<WinnerRevealScreen />} />
          {import.meta.env.DEV && <Route path="/demo" element={<FeatureDemoScreen />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastHost />
      </div>
    </MemoryRouter>
  );
}

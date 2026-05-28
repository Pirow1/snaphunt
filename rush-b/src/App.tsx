import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useStore } from './lib/store';
import { initVision } from './lib/vision';
import HomeScreen from './screens/HomeScreen';
import CreateLobbyScreen from './screens/CreateLobbyScreen';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameRouter from './screens/GameRouter';
import WinnerRevealScreen from './screens/WinnerRevealScreen';
import FeatureDemoScreen from './screens/FeatureDemoScreen';
import { ToastHost } from './components/ui/ToastHost';

export default function App() {
  const setAuthUserId = useStore((s) => s.setAuthUserId);
  const setVisionLoadProgress = useStore((s) => s.setVisionLoadProgress);
  const setVisionReady = useStore((s) => s.setVisionReady);

  useEffect(() => {
    initVision((pct) => setVisionLoadProgress(pct))
      .then(() => setVisionReady(true))
      .catch((err) => console.error('[vision] init failed:', err));
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });

    const w = window as unknown as { supabase: typeof supabase; useStore: typeof useStore };
    w.supabase = supabase;
    w.useStore = useStore;

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [setAuthUserId]);

  return (
    <div id="app">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
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
  );
}

import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useStore } from './lib/store';
import { initVision } from './lib/vision';
import DashboardScreen from './screens/DashboardScreen';
import RushBApp from './rush-b/RushBApp';
import HomeScreen from './screens/HomeScreen';
import CreateLobbyScreen from './screens/CreateLobbyScreen';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameRouter from './screens/GameRouter';
import VerifyingScreen from './screens/VerifyingScreen';
import ResultScreen from './screens/ResultScreen';
import WinnerRevealScreen from './screens/WinnerRevealScreen';
import GalleryScreen from './screens/GalleryScreen';
import VisionTestScreen from './screens/VisionTestScreen';
import CompassTestScreen from './screens/CompassTestScreen';
import TrapTestScreen from './screens/TrapTestScreen';
import { ToastHost } from './components/ui/ToastHost';

export default function App() {
  const setAuthUserId = useStore((s) => s.setAuthUserId);
  const setVisionLoadProgress = useStore((s) => s.setVisionLoadProgress);
  const setVisionReady = useStore((s) => s.setVisionReady);

  // Pillar 1 pre-warm — kicks off the moment the app loads, regardless of
  // which route the user lands on (HomeScreen, /join deep link, /game refresh
  // etc.). initVision is module-scope idempotent.
  useEffect(() => {
    initVision((pct) => setVisionLoadProgress(pct))
      .then(() => setVisionReady(true))
      .catch((err) => console.error('[vision] init failed:', err));
  }, [setVisionLoadProgress, setVisionReady]);

  useEffect(() => {
    // Bootstrap anon auth: reuse an existing session if one is cached in
    // localStorage; otherwise create a fresh anonymous user. Listen for any
    // future auth events so the store stays in sync.
    let cancelled = false;

    (async () => {
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        if (!cancelled) setAuthUserId(existing.session.user.id);
        return;
      }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('signInAnonymously failed:', error);
        return;
      }
      if (!cancelled) setAuthUserId(data.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });

    // Expose anon-key supabase client + store on window for console debugging
    // from any deployed device (no service role, no secrets — anon-only). Also
    // unblocks the production-bundle smokes that read from window.useStore.
    const w = window as unknown as {
      supabase: typeof supabase;
      useStore: typeof useStore;
    };
    w.supabase = supabase;
    w.useStore = useStore;

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [setAuthUserId]);

  return (
    <div id="app">
      <Routes>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/snaphunt" element={<HomeScreen />} />
        <Route path="/rushb" element={<RushBApp onExit={() => window.history.back()} />} />
        <Route path="/create" element={<CreateLobbyScreen />} />
        <Route path="/join" element={<JoinScreen />} />
        <Route path="/join/:code" element={<JoinScreen />} />
        <Route path="/lobby/:sessionId" element={<LobbyScreen />} />
        <Route path="/game/:sessionId" element={<GameRouter />} />
        <Route path="/game/:sessionId/verify" element={<VerifyingScreen />} />
        <Route path="/game/:sessionId/result" element={<ResultScreen />} />
        <Route path="/game/:sessionId/winner" element={<WinnerRevealScreen />} />
        <Route path="/gallery/:sessionId" element={<GalleryScreen />} />
        {import.meta.env.DEV && <Route path="/vision-test" element={<VisionTestScreen />} />}
        {import.meta.env.DEV && <Route path="/compass-test" element={<CompassTestScreen />} />}
        {import.meta.env.DEV && <Route path="/trap-test" element={<TrapTestScreen />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </div>
  );
}

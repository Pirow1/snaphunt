import { Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from './screens/HomeScreen';
import CreateLobbyScreen from './screens/CreateLobbyScreen';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import RoleRevealScreen from './screens/RoleRevealScreen';
import HiderCaptureScreen from './screens/HiderCaptureScreen';
import HiderWaitScreen from './screens/HiderWaitScreen';
import SeekerHuntScreen from './screens/SeekerHuntScreen';
import VerifyingScreen from './screens/VerifyingScreen';
import ResultScreen from './screens/ResultScreen';
import GalleryScreen from './screens/GalleryScreen';

export default function App() {
  return (
    <div id="app">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/create" element={<CreateLobbyScreen />} />
        <Route path="/join" element={<JoinScreen />} />
        <Route path="/join/:code" element={<JoinScreen />} />
        <Route path="/lobby/:sessionId" element={<LobbyScreen />} />
        <Route path="/game/:sessionId/role" element={<RoleRevealScreen />} />
        <Route path="/game/:sessionId/hide" element={<HiderCaptureScreen />} />
        <Route path="/game/:sessionId/wait" element={<HiderWaitScreen />} />
        <Route path="/game/:sessionId/seek" element={<SeekerHuntScreen />} />
        <Route path="/game/:sessionId/verify" element={<VerifyingScreen />} />
        <Route path="/game/:sessionId/result" element={<ResultScreen />} />
        <Route path="/gallery/:sessionId" element={<GalleryScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

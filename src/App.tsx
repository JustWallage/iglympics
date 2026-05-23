import { Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { MusicProvider } from "./context/MusicContext";
import LoginModal from "./components/LoginModal";
import SplashScreen from "./components/SplashScreen";
import Dashboard from "./pages/Dashboard";
import Scoreboard from "./pages/Scoreboard";
import Profile from "./pages/Profile";
import Matches from "./pages/Matches";
import Chat from "./pages/Chat";
import Schedule from "./pages/Schedule";
import Minigames from "./pages/Minigames";
import Snaps from "./pages/Snaps";
import AdminMatches from "./pages/AdminMatches";
import Layout from "./components/Layout";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, openLoginModal } = useAuth();
  if (loading) return null;
  if (!user) {
    openLoginModal();
    return <Navigate to="/" replace />;
  }
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const [entered, setEntered] = useState(false);

  return (
    <AuthProvider>
      <WebSocketProvider>
        <MusicProvider>
          {!entered && <SplashScreen onEnter={() => setEntered(true)} />}
          <LoginModal />
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="scoreboard" element={<Scoreboard />} />
              <Route path="matches" element={<Matches />} />
              <Route path="chat" element={<Chat />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="games" element={<Minigames />} />
              <Route path="snaps" element={<Snaps />} />
              <Route path="profile/:userId" element={<Profile />} />
              <Route
                path="admin/matches"
                element={
                  <AdminRoute>
                    <AdminMatches />
                  </AdminRoute>
                }
              />
            </Route>
          </Routes>
        </MusicProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

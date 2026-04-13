import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import LoginModal from "./components/LoginModal";
import Scoreboard from "./pages/Scoreboard";
import Profile from "./pages/Profile";
import Matches from "./pages/Matches";
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
  return (
    <AuthProvider>
      <WebSocketProvider>
        <LoginModal />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Scoreboard />} />
            <Route path="matches" element={<Matches />} />
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
      </WebSocketProvider>
    </AuthProvider>
  );
}

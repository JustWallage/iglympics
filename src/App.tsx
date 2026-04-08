import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import Login from "./pages/Login";
import Scoreboard from "./pages/Scoreboard";
import Profile from "./pages/Profile";
import AdminMatches from "./pages/AdminMatches";
import Layout from "./components/Layout";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Scoreboard />} />
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

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

interface User {
  id: number;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  showLoginModal: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = (await res.json()) as { user: User; isAdmin: boolean };
        setUser(data.user);
        setIsAdmin(data.isAdmin);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("username");
    const password = params.get("password");

    if (name && password) {
      // Strip credentials from URL immediately
      params.delete("username");
      params.delete("password");
      const clean = params.toString();
      const url = window.location.pathname + (clean ? `?${clean}` : "") + window.location.hash;
      window.history.replaceState({}, "", url);

      // Auto-login then fetch user
      fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      })
        .then((res) => {
          if (res.ok) return fetchMe();
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      fetchMe();
    }
  }, [fetchMe]);

  const login = async (name: string, password: string) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err.error || "Login failed");
    }
    await fetchMe();
    setShowLoginModal(false);
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setIsAdmin(false);
  };

  const openLoginModal = useCallback(() => setShowLoginModal(true), []);
  const closeLoginModal = useCallback(() => setShowLoginModal(false), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        login,
        logout,
        loading,
        showLoginModal,
        openLoginModal,
        closeLoginModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

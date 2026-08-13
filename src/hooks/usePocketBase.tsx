import PocketBase, { type RecordModel } from "pocketbase";
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

const PB_URL = import.meta.env.VITE_POCKETBASE_URL as string;

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

interface AuthContextValue {
  user: RecordModel | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (email: string, password: string, passwordConfirm: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const stored = pb.authStore.isValid;
    if (stored) {
      setUser(pb.authStore.record);
      setToken(pb.authStore.token);
    }
    setIsLoading(false);

    const unsub = pb.authStore.onChange((_token, model) => {
      setToken(_token);
      setUser(model);
    });
    return () => { unsub(); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await pb.collection("users").authWithPassword(email, password);
    setToken(result.token);
    setUser(result.record);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const register = useCallback(async (email: string, password: string, passwordConfirm: string) => {
    await pb.collection("users").create({ email, password, passwordConfirm });
    await login(email, password);
  }, [login]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export { pb };

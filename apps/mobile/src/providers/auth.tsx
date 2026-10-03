import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  setSession,
  type StoredUser,
} from "../lib/auth-store";
import { mobileLogin } from "../lib/api";
import { registerForPush } from "../lib/push";

type AuthState = {
  ready: boolean;
  user: StoredUser | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [t, u] = await Promise.all([getAccessToken(), getStoredUser()]);
      setToken(t);
      setUser(u);
      setReady(true);
      if (t) void registerForPush();
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await mobileLogin(email.trim().toLowerCase(), password);
    if (res.user.role !== "CLIENT") {
      throw new Error("CLIENTS_ONLY");
    }
    await setSession({ accessToken: res.accessToken, user: res.user });
    setToken(res.accessToken);
    setUser(res.user);
    void registerForPush();
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await getStoredUser();
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({ ready, user, token, signIn, signOut, refreshUser }),
    [ready, user, token, signIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

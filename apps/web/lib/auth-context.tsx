"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, PublicUser } from "./api";

interface AuthContextValue {
  user: PublicUser | null;
  accessToken: string | null;
  isLoading: boolean;
  setSession: (accessToken: string, user: PublicUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setSession = useCallback((token: string, nextUser: PublicUser) => {
    setAccessToken(token);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    // Sahifa yangilanganda access token xotiradan o'chib ketadi (u faqat JS state'da
    // saqlanadi — XSS orqali o'g'irlanish xavfini kamaytirish uchun localStorage'da EMAS).
    // Shuning uchun refreshToken httpOnly cookie orqali "jim" (silent) tarzda tiklanadi.
    authApi
      .refresh()
      .then(async ({ accessToken: token }) => {
        const { user: me } = await authApi.me(token);
        setSession(token, me);
      })
      .catch(() => {
        // Cookie yo'q yoki muddati o'tgan — foydalanuvchi shunchaki login qilmagan.
      })
      .finally(() => setIsLoading(false));
  }, [setSession]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth AuthProvider ichida ishlatilishi kerak.");
  return ctx;
}
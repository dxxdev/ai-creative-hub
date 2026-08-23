"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * apps/web/lib/auth-store.tsx
 *
 * Access tokenni React state'da (xotirada) saqlaydigan yengil context.
 * Sahifalar orasida o'tishda (client-side navigation) yo'qolmaydi, lekin
 * sahifa to'liq qayta yuklanganda (F5) tozalanadi — bu ataylab shunday:
 * access token qisqa muddatli bo'lishi kerak, va uzoq muddatli sessiya
 * backend'dagi httpOnly `refreshToken` cookie orqali boshqariladi
 * (login'da server shu cookie'ni allaqachon o'rnatadi).
 *
 * Keyingi qadam sifatida: ilova ochilganda `POST /api/auth/refresh`
 * chaqirib, shu cookie orqali yangi access token olib, uni shu yerga
 * qayta yozish mumkin — hozircha bu context faqat "joriy sessiyadagi"
 * access tokenni saqlaydi.
 */

interface AuthContextValue {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const value = useMemo(() => ({ accessToken, setAccessToken }), [accessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth() faqat <AuthProvider> ichida ishlatilishi kerak");
  }

  return ctx;
}
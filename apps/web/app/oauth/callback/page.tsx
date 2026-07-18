"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Access token faqat "#" fragmentda keladi — hech qachon serverga (yoki
    // browser tarixiga query sifatida) yuborilmaydi, shuning uchun window.location'dan o'qiladi.
    const params = new URLSearchParams(window.location.hash.replace("#", ""));
    const accessToken = params.get("accessToken");
    const next = params.get("next") ?? "/feed";

    if (!accessToken) {
      setError("Google orqali kirishda xatolik yuz berdi.");
      return;
    }

    authApi
      .me(accessToken)
      .then(({ user }) => {
        setSession(accessToken, user);
        router.replace(next);
      })
      .catch(() => setError("Sessiyani tasdiqlab bo'lmadi. Qaytadan urinib ko'ring."));
  }, [router, setSession]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="font-body text-sm text-slate-soft">
        {error ?? "Tizimga kirilmoqda..."}
      </p>
    </div>
  );
}
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth-context";

export default function FeedPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="font-body text-sm text-slate-soft">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-6 text-center">
      <p className="font-mono text-xs tracking-widest text-marigold-dim">SPRINT 2&apos;DA TO&apos;LDIRILADI</p>
      <h1 className="font-display text-3xl font-medium text-ink">
        Xush kelibsiz, @{user.username ?? user.email}
      </h1>
      <p className="max-w-sm font-body text-sm text-slate-soft">
        Autentifikatsiya oqimi (register → verify-email/Google → onboarding → feed) muvaffaqiyatli
        ishlayapti. Post/Prompt feed&apos;i navbatdagi bosqichda shu yerga qo&apos;shiladi.
      </p>
      <div className="w-40">
        <Button variant="secondary" onClick={() => logout().then(() => router.push("/login"))}>
          Chiqish
        </Button>
      </div>
    </div>
  );
}
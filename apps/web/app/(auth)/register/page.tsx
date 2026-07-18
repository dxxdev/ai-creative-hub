"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { ApiError, authApi } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.register(email, password);
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ro'yxatdan o'tishda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="BOSHLASH" title="Hisob yarating">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="siz@misol.com"
        />
        <FormField
          id="password"
          label="Parol"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Kamida 8 belgi, 1 katta harf, 1 raqam, 1 maxsus belgi"
        />
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
        <Button type="submit" isLoading={isLoading}>
          Ro&apos;yxatdan o&apos;tish
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="font-mono text-xs text-slate-soft">YOKI</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={() => (window.location.href = authApi.googleLoginUrl())}
      >
        Google bilan davom etish
      </Button>

      <p className="mt-8 font-body text-sm text-slate-soft">
        Hisobingiz bormi?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-2">
          Tizimga kiring
        </Link>
      </p>
    </AuthShell>
  );
}
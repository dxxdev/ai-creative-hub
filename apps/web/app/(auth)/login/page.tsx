"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { ApiError, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { accessToken, user } = await authApi.login(email, password);
      setSession(accessToken, user);
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kirishda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="XUSH KELIBSIZ" title="Tizimga kiring">
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="-mt-1 text-right">
          <Link href="/forgot-password" className="font-body text-xs text-slate-soft underline underline-offset-2">
            Parolni unutdingizmi?
          </Link>
        </div>
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
        <Button type="submit" isLoading={isLoading}>
          Kirish
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
        Hisobingiz yo&apos;qmi?{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-2">
          Ro&apos;yxatdan o&apos;ting
        </Link>
      </p>
    </AuthShell>
  );
}
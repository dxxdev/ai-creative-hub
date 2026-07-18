"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { ApiError, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { accessToken, user } = await authApi.verifyEmail(email, otp);
      setSession(accessToken, user);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod tekshirishda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="DEYARLI TAYYOR" title="Emailingizni tasdiqlang">
      <p className="mb-6 font-body text-sm text-slate-soft">
        <span className="font-medium text-ink">{email}</span> manziliga 6 xonali kod yubordik. Kodni
        pastga kiriting (10 daqiqa amal qiladi).
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          id="otp"
          label="Tasdiqlash kodi"
          inputMode="numeric"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="tracking-[0.5em]"
        />
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
        <Button type="submit" isLoading={isLoading}>
          Tasdiqlash
        </Button>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
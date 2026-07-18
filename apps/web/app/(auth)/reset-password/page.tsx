"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { ApiError, authApi } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Parolni yangilashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell eyebrow="XATOLIK" title="Havola yaroqsiz">
        <p className="font-body text-sm text-slate-soft">
          Tiklash havolasi to&apos;liq emas. Iltimos, parolni tiklashni qaytadan so&apos;rang.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="YANGI PAROL" title="Yangi parol o'rnating">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="newPassword"
          label="Yangi parol"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Kamida 8 belgi, 1 katta harf, 1 raqam, 1 maxsus belgi"
        />
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
        <Button type="submit" isLoading={isLoading}>
          Parolni yangilash
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
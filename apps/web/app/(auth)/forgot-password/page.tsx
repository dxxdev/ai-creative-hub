"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { ApiError, authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="TIKLASH" title="Parolni tiklash">
      {message ? (
        <p className="font-body text-sm text-ink">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="font-body text-sm text-slate-soft">
            Emailingizni kiriting — agar hisob mavjud bo&apos;lsa, tiklash havolasini yuboramiz.
          </p>
          <FormField
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="siz@misol.com"
          />
          {error && <p className="font-body text-sm text-red-600">{error}</p>}
          <Button type="submit" isLoading={isLoading}>
            Tiklash havolasini yuborish
          </Button>
        </form>
      )}
      <p className="mt-8 font-body text-sm text-slate-soft">
        <Link href="/login" className="font-medium text-ink underline underline-offset-2">
          Tizimga kirishga qaytish
        </Link>
      </p>
    </AuthShell>
  );
}
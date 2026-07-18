"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { ApiError, usersApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, accessToken, isLoading, setSession } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.replace("/login");
    }
  }, [isLoading, accessToken, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !user) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const { user: updated } = await usersApi.setUsername(username, accessToken);
      setSession(accessToken, updated);
      router.push("/feed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Username saqlashda xatolik yuz berdi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell eyebrow="OXIRGI QADAM" title="Username tanlang">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="username"
          label="Username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="ustaraassan_ai"
        />
        <p className="-mt-2 font-mono text-xs text-slate-soft">
          ai-creative-hub.dev/@{username || "username"}
        </p>
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
        <Button type="submit" isLoading={isSubmitting}>
          Davom etish
        </Button>
      </form>
    </AuthShell>
  );
}
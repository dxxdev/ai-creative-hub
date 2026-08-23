"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VerifyEmailSchema } from "@repo/shared";
import { apiClient, ApiError, ApiNetworkError } from "@/lib/api-client";
import { FormBanner } from "@/components/form-banner";
import { Spinner } from "@/components/spinner";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function focusBox(index: number) {
    inputRefs.current[index]?.focus();
  }

  function handleDigitChange(index: number, rawValue: string) {
    const value = rawValue.replace(/\D/g, "").slice(-1);

    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (value && index < OTP_LENGTH - 1) {
      focusBox(index + 1);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
      focusBox(index - 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    focusBox(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  function resetOtpBoxes() {
    setDigits(Array(OTP_LENGTH).fill(""));
    focusBox(0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);

    if (!email) {
      setOtpError("Email topilmadi. Iltimos, ro'yxatdan o'tish sahifasiga qayting.");
      return;
    }

    const otpCode = digits.join("");
    const parsed = VerifyEmailSchema.safeParse({ email, otpCode });

    if (!parsed.success) {
      setOtpError(
        parsed.error.issues[0]?.message ?? "Tasdiqlash kodi noto'g'ri formatda",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post("/api/auth/verify-email", {
        body: parsed.data,
      });

      router.push("/login?verified=1");
    } catch (err) {
      if (err instanceof ApiError) {
        setOtpError(err.message);
      } else if (err instanceof ApiNetworkError) {
        setOtpError(err.message);
      } else {
        setOtpError("Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
      }
      resetOtpBoxes();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email || cooldown > 0 || isResending) return;

    setResendMessage(null);
    setOtpError(null);
    setIsResending(true);

    try {
      const result = await apiClient.post<{ message: string }>(
        "/api/auth/resend-verification",
        { body: { email } },
      );

      setResendMessage(result.message ?? "Tasdiqlash kodi qayta yuborildi");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          const match = err.message.match(/(\d+)\s*soniya/);
          setCooldown(match ? Number(match[1]) : RESEND_COOLDOWN_SECONDS);
        }
        setOtpError(err.message);
      } else if (err instanceof ApiNetworkError) {
        setOtpError(err.message);
      } else {
        setOtpError("Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
      }
    } finally {
      setIsResending(false);
    }
  }

  if (!email) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-2xl font-bold tracking-tight">Email topilmadi</h1>
          <p className="mb-6 text-sm text-gray-600">
            Tasdiqlash sahifasini to'g'ri ochish uchun avval ro'yxatdan o'ting.
          </p>
          
          <a  href="/register"
            className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            Ro'yxatdan o'tish
          </a>
        </div>
      </main>
    );
  }

  const isCodeComplete = digits.every((d) => d !== "");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Emailni tasdiqlang</h1>
        <p className="mb-6 text-sm text-gray-600">
          <span className="font-medium text-gray-900">{email}</span> manziliga
          yuborilgan 6 xonali kodni kiriting.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4 flex justify-between gap-2">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                aria-label={`Tasdiqlash kodining ${index + 1}-raqami`}
                className="h-14 w-12 rounded-md border border-gray-300 text-center text-xl font-semibold focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            ))}
          </div>

          {otpError && (
            <FormBanner variant="error" className="mb-4">
              {otpError}
            </FormBanner>
          )}

          {resendMessage && !otpError && (
            <FormBanner variant="success" className="mb-4">
              {resendMessage}
            </FormBanner>
          )}

          <button
  type="submit"
  disabled={isCodeComplete || isSubmitting}
  className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {isSubmitting && <Spinner />}
  {isSubmitting ? "Tekshirilmoqda..." : "Tasdiqlash"}
</button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {cooldown > 0 ? (
            <span>Qayta yuborish {cooldown} soniyadan keyin mavjud bo'ladi</span>
          ) : (
            <button
  type="button"
  onClick={handleResend}
  disabled={isSubmitting}
  className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {isSubmitting && <Spinner />}
  {isSubmitting ? "Yuborilmoqda" : "Kodni qayta yuborish"}
</button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
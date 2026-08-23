"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import type { ResetPasswordInput } from "@repo/shared";
import { apiClient, ApiError, ApiNetworkError } from "@/lib/api-client";

/**
 * Backend `resetPasswordSchema` faqat { token, newPassword }ni talab qiladi —
 * "parolni takrorlash" maydoni backend kontraktida yo'q, bu sof klient
 * tomondagi UX qulayligi. Shuning uchun bu yerda `@repo/shared`dagi zod
 * sxemasidan emas, react-hook-form'ning o'z `validate` qoidalaridan
 * foydalanamiz — apps/web'ga alohida `zod` bog'liqligini qo'shmasdan.
 */
interface ResetPasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setFormError(null);

    if (!token) {
      setFormError("Havola yaroqsiz. Iltimos, parolni tiklashni qaytadan so'rang.");
      return;
    }

    const payload: ResetPasswordInput = {
      token,
      newPassword: values.newPassword,
    };

    try {
      await apiClient.post("/api/auth/reset-password", { body: payload });

      router.push("/login?reset=1");
    } catch (err) {
      if (err instanceof ApiError) {
        // Masalan 400 — "Yaroqsiz yoki muddati o'tgan havola"
        setFormError(err.message);
        return;
      }

      if (err instanceof ApiNetworkError) {
        setFormError(err.message);
        return;
      }

      setFormError("Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-2xl font-bold tracking-tight">Havola yaroqsiz</h1>
          <p className="mb-6 text-sm text-gray-600">
            Parolni tiklash havolasi topilmadi yoki noto'g'ri. Iltimos, qaytadan
            so'rang.
          </p>
          
          <a href="/forgot-password"
            className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700" >
            Parolni tiklashni so'rash
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Yangi parol o'rnating</h1>
        <p className="mb-6 text-sm text-gray-600">
          Hisobingiz uchun yangi parol kiriting.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-gray-700">
              Yangi parol
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              {...register("newPassword", {
                required: "Parol talab qilinadi",
                minLength: {
                  value: 8,
                  message: "Parol kamida 8 belgidan iborat bo'lishi kerak",
                },
                validate: {
                  hasUpper: (value) =>
                    /[A-Z]/.test(value) || "Parolda kamida 1 ta katta harf bo'lishi kerak",
                  hasNumber: (value) =>
                    /[0-9]/.test(value) || "Parolda kamida 1 ta raqam bo'lishi kerak",
                  hasSpecial: (value) =>
                    /[^A-Za-z0-9]/.test(value) ||
                    "Parolda kamida 1 ta maxsus belgi bo'lishi kerak",
                },
              })}
            />
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Parolni takrorlang
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              {...register("confirmPassword", {
                required: "Parolni takrorlang",
                validate: (value) =>
                  value === watch("newPassword") || "Parollar bir-biriga mos kelmadi",
              })}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saqlanmoqda..." : "Parolni yangilash"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
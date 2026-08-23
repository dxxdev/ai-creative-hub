"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@repo/shared";
import { apiClient, ApiError, ApiNetworkError } from "@/lib/api-client";
import { FormBanner } from "@/components/form-banner";
import { Spinner } from "@/components/spinner";

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export default function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(input: ForgotPasswordInput) {
    setFormError(null);

    try {
      const result = await apiClient.post<ForgotPasswordResponse>(
        "/api/auth/forgot-password",
        { body: input },
      );

      setSuccessMessage(
        result.message ?? "Agar bu email mavjud bo'lsa, xat yuborildi",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors?.email?.[0]) {
          setError("email", { message: err.fieldErrors.email[0] });
          return;
        }
        setFormError(err.message);
        return;
      }

      if (err instanceof ApiNetworkError) {
        setFormError(err.message);
        return;
      }

      setFormError(
        "Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.",
      );
    }
  }

  if (successMessage) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-2 text-2xl font-bold tracking-tight">
            Xatni tekshiring
          </h1>
          <p className="mb-6 text-sm text-gray-600">{successMessage}</p>

          <a
            href="/login"
            className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            Kirish sahifasiga qaytish
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">
          Parolni tiklash
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Hisobingizga bog'langan emailni kiriting — parolni tiklash havolasini
          yuboramiz.
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          {formError && <FormBanner variant="error">{formError}</FormBanner>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Spinner />}
            {isSubmitting ? "Yuborilmoqda..." : "Havola yuborish"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          <a
            href="/login"
            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
          >
            Kirish sahifasiga qaytish
          </a>
        </p>
      </div>
    </main>
  );
}

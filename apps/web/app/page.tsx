"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema, type RegisterInput } from "@repo/shared";
import { apiClient, ApiError, ApiNetworkError } from "@/lib/api-client";

interface RegisterResponse {
  user: {
    id: string;
    email: string;
    username: string;
    status: string;
    createdAt: string;
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: RegisterInput) {
    setFormError(null);

    try {
      const { user } = await apiClient.post<RegisterResponse>("/api/auth/register", {
        body: data,
      });

      router.push(`/verify-email?email=${encodeURIComponent(user.email)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        // Backend `validateSchema` field-level xatolarni qaytargan bo'lsa,
        // ularni to'g'ridan-to'g'ri formaning tegishli maydonlariga bog'laymiz
        if (err.fieldErrors) {
          for (const [field, messages] of Object.entries(err.fieldErrors)) {
            if (messages[0] && (field === "email" || field === "password" || field === "confirmPassword")) {
              setError(field as keyof RegisterInput, { message: messages[0] });
            }
          }
          return;
        }

        // Masalan: 409 — "Bu email allaqachon ro'yxatdan o'tgan"
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Ro'yxatdan o'tish</h1>
        <p className="mb-6 text-sm text-gray-600">
          AI Creative Hub'da hisob yarating.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
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
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Parol
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
              Parolni takrorlang
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              {...register("confirmPassword")}
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
            {isSubmitting ? "Yuborilmoqda..." : "Ro'yxatdan o'tish"}
          </button>
        </form>
      </div>
    </main>
  );
}
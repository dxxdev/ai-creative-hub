"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@repo/shared";
import { apiClient, ApiError, ApiNetworkError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-store";

interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      status: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken } = useAuth();

  const justVerified = searchParams.get("verified") === "1";
  const [formError, setFormError] = useState<string | null>(null);
  const justReset = searchParams.get("reset") === "1";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(input: LoginInput) {
    setFormError(null);

    try {
      const { data } = await apiClient.post<LoginResponse>("/api/auth/login", {
        body: input,
      });

      setAccessToken(data.accessToken);
      router.push("/feed");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          for (const [field, messages] of Object.entries(err.fieldErrors)) {
            if (messages[0] && (field === "email" || field === "password")) {
              setError(field as keyof LoginInput, { message: messages[0] });
            }
          }
          return;
        }

        if (err.status === 403) {
          // Backend: "Email hali tasdiqlanmagan..." — tasdiqlash sahifasiga yo'naltiramiz
          router.push(`/verify-email?email=${encodeURIComponent(input.email)}`);
          return;
        }

        // Masalan 401 — "Email yoki parol noto'g'ri"
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Kirish</h1>
        <p className="mb-6 text-sm text-gray-600">
          AI Creative Hub hisobingizga kiring.
        </p>

        {justVerified && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Email muvaffaqiyatli tasdiqlandi. Endi tizimga kirishingiz mumkin.
          </p>
        )}

        {justReset && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Parolingiz muvaffaqiyatli yangilandi. Endi yangi parol bilan kiring.
          </p>
        )}

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

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Parol
              </label>

              <a
                href="/forgot-password"
                className="text-sm font-medium text-gray-600 underline underline-offset-2 hover:text-gray-900"
              >
                Parolni unutdingizmi?
              </a>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">
                {errors.password.message}
              </p>
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
            {isSubmitting ? "Kirilmoqda..." : "Kirish"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Hisobingiz yo'qmi?{" "}
          <a
            href="/register"
            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-700"
          >
            Ro'yxatdan o'ting
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

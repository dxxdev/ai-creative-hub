// apps/web/lib/api-client.ts
/**
 * apps/web/lib/api-client.ts
 *
 * Butun frontend bo'ylab ishlatiladigan markazlashtirilgan API client.
 * - Base URL `NEXT_PUBLIC_API_URL` orqali .env'dan olinadi.
 * - Har bir so'rovda cookie'lar `credentials: "include"` bilan yuboriladi
 *   (backend httpOnly refresh-token cookie'siga tayanadi).
 * - Muvaffaqiyatsiz javoblar JSON sifatida parse qilinib, `ApiError`
 *   ko'rinishida uloqtiriladi — backend errorHandler qaytaradigan
 *   `{ error, errors?, details? }` shakliga mos.
 */

import { useAuthStore } from "@/store/auth.store";


const AUTH_ENDPOINTS_EXEMPT_FROM_REFRESH = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) return null;

        const data = await response.json().catch(() => null);
        const newAccessToken: string | undefined = data?.data?.accessToken;

        if (!newAccessToken) return null;

        useAuthStore.getState().setAccessToken(newAccessToken);
        return newAccessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL aniqlanmagan. Iltimos, .env.local faylini apps/web/.env.local.example namunasiga qarab to'ldiring.",
    );
  }

  // Oxiridagi "/" bo'lsa olib tashlaymiz, shunda path qo'shishda "//" hosil bo'lmaydi
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Backend `validateSchema` middleware'i 400 statusda qaytaradigan
 * maydon bo'yicha validatsiya xatolari: { fieldName: ["xato1", "xato2"] }
 */
export type ApiFieldErrors = Record<string, string[]>;

/**
 * Backend errorHandler qaytarishi mumkin bo'lgan xato javobining shakli.
 * Aniq shakl endpoint'ga qarab farq qilishi mumkin, shuning uchun
 * qo'shimcha maydonlar ham ruxsat etiladi.
 */
export interface ApiErrorBody {
  error?: string;
  errors?: ApiFieldErrors;
  details?: unknown;
  [key: string]: unknown;
}

/**
 * API'dan kelgan xato javobini ifodalovchi xato klassi.
 * `message` — foydalanuvchiga ko'rsatsa bo'ladigan xabar (backend `error`
 * maydonidan olinadi), `status` — HTTP status kodi, `body` — to'liq
 * parse qilingan javob (masalan, `errors` maydonini formaga bog'lash uchun).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly body: ApiErrorBody | null;

  constructor(message: string, status: number, body: ApiErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;

    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /** Field-level validatsiya xatolari (agar backend shularni qaytargan bo'lsa). */
  get fieldErrors(): ApiFieldErrors | undefined {
    return this.body?.errors;
  }
}

/** Tarmoq darajasidagi xato (server umuman javob bermadi: offline, CORS, timeout va h.k.). */
export class ApiNetworkError extends Error {
  constructor(cause: unknown) {
    super("Serverga ulanib bo'lmadi. Internet aloqangizni tekshiring.");
    this.name = "ApiNetworkError";
    this.cause = cause;

    Object.setPrototypeOf(this, ApiNetworkError.prototype);
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "method"> {
  /** So'rov tanasi — avtomatik JSON.stringify qilinadi (FormData/undefined bo'lsa, o'zgarishsiz yuboriladi). */
  body?: unknown;
  /** Query-parametrlar — avtomatik URLSearchParams'ga aylantiriladi. */
  params?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(
  path: string,
  params?: ApiRequestOptions["params"],
): string {
  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    `${getApiBaseUrl()}/`,
  );

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  // 204 No Content yoki bo'sh javob tanasi bo'lsa, parse qilishga urinmaymiz
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Backend har doim JSON qaytarishi kutiladi; lekin masalan proxy/CDN
    // xatosi HTML qaytarsa, buzilib qolmaslik uchun xom matnni saqlaymiz
    return { error: text };
  }
}

async function request<TResponse = unknown>(
  path: string,
  method: string,
  options: ApiRequestOptions = {},
  isRetryAfterRefresh = false,
): Promise<TResponse>  {
  const { body, params, headers, ...rest } = options;
  const accessToken = useAuthStore.getState().accessToken;

  const isJsonBody =
    body !== undefined && !(body instanceof FormData) && !(body instanceof Blob);

  // MUHIM: URL'ni try/catch'dan TASHQARIDA quramiz. getApiBaseUrl() konfiguratsiya
  // xatosi (masalan NEXT_PUBLIC_API_URL aniqlanmagan) uloqtirishi mumkin — bu
  // fetch'ning o'zi bilan bog'liq TARMOQ xatosi emas. Agar shu yerda bo'lsa,
  // pastdagi catch uni noto'g'ri ravishda ApiNetworkError'ga aylantirib,
  // haqiqiy sababni (konfiguratsiya) yashirib qo'yardi.
  const url = buildUrl(path, params);

  let response: Response;

  try {
    response = await fetch(url, {
      ...rest,
      method,
      credentials: "include",
      headers: {
        ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | undefined),
    });
  } catch (cause) {
    throw new ApiNetworkError(cause);
  }

  if (
    response.status === 401 &&
    !isRetryAfterRefresh &&
    !AUTH_ENDPOINTS_EXEMPT_FROM_REFRESH.has(path)
  ) {
    const newAccessToken = await refreshAccessToken();

    if (newAccessToken) {
      return request<TResponse>(path, method, options, true);
    }

    useAuthStore.getState().clearSession();
  }

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const body = (data ?? null) as ApiErrorBody | null;
    const message = body?.error ?? response.statusText ?? "Noma'lum xatolik yuz berdi";
    throw new ApiError(message, response.status, body);
  }

  return data as TResponse;
}

/**
 * Markazlashtirilgan API client.
 *
 * @example
 * const { user } = await apiClient.post<AuthResponse>("/api/auth/login", {
 *   body: { email, password },
 * });
 *
 * @example xato ushlash
 * try {
 *   await apiClient.post("/api/auth/reset-password", { body: { token, newPassword } });
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     // err.status, err.message, err.fieldErrors bilan ishlash
 *   } else if (err instanceof ApiNetworkError) {
 *     // internet/serverga ulanish muammosi
 *   }
 * }
 */
export const apiClient = {
  get: <TResponse = unknown>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>(path, "GET", options),

  post: <TResponse = unknown>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>(path, "POST", options),

  put: <TResponse = unknown>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>(path, "PUT", options),

  patch: <TResponse = unknown>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>(path, "PATCH", options),

  delete: <TResponse = unknown>(path: string, options?: ApiRequestOptions) =>
    request<TResponse>(path, "DELETE", options),
};
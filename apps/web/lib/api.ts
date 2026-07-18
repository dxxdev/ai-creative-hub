const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    // Refresh token httpOnly cookie'si shu orqali brauzerdan avtomatik yuboriladi/qabul qilinadi.
    credentials: "include",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? "Noma'lum xatolik yuz berdi.");
  }

  return body as T;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export const authApi = {
  register: (email: string, password: string) =>
    request<{ message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  verifyEmail: (email: string, otp: string) =>
    request<AuthResponse>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  refresh: () => request<{ accessToken: string }>("/auth/refresh", { method: "POST" }),

  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),

  me: (accessToken: string) => request<{ user: PublicUser }>("/auth/me", { accessToken }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  googleLoginUrl: () => `${API_URL}/auth/oauth/google`,
};

export const usersApi = {
  setUsername: (username: string, accessToken: string) =>
    request<{ user: PublicUser }>("/users/me/username", {
      method: "PATCH",
      body: JSON.stringify({ username }),
      accessToken,
    }),
};
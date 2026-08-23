import { create } from "zustand";

/**
 * apps/web/store/auth.store.ts
 *
 * Autentifikatsiya holatini FAQAT XOTIRADA saqlaydi — hech qanday `persist`
 * middleware ishlatilmagan, shuning uchun localStorage/sessionStorage'ga
 * yozilmaydi. Bu ataylab shunday: access token qisqa muddatli bo'lishi
 * kerak va sahifa to'liq qayta yuklanganda (F5) tozalanishi kutiladi.
 * Uzoq muddatli sessiya backend'dagi httpOnly `refreshToken` cookie orqali
 * boshqariladi — access token muddati tugaganda (yoki topilmaganda),
 * `lib/api-client.ts`dagi interceptor shu cookie orqali avtomatik
 * `POST /api/auth/refresh` chaqirib, yangi access tokenni shu yerga yozadi.
 */

/**
 * Backend turli auth endpointlarida (login/register/verify-email) qaytargan
 * `user` obyektining umumiy qismi. `@repo/shared`dagi `PublicUser` bilan
 * ataylab bir xil emas — u yerdagi tip (`name`, `createdAt`, `updatedAt`)
 * amaldagi controller javoblaridan (`status` maydoni bilan, `name`siz)
 * farq qiladi. Bu — alohida tuzatish talab qiladigan mavjud nomuvofiqlik.
 */
export interface AuthUser {
  id: string;
  email: string;
  status: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  /** Login/register/verify muvaffaqiyatidan keyin to'liq sessiyani o'rnatadi. */
  setSession: (session: { user: AuthUser; accessToken: string }) => void;

  /** Faqat access tokenni yangilaydi (masalan /refresh javobidan keyin) — user o'zgarmaydi. */
  setAccessToken: (accessToken: string) => void;

  /** Logout yoki refresh muvaffaqiyatsiz bo'lganda butun sessiyani tozalaydi. */
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setSession: ({ user, accessToken }) =>
    set({ user, accessToken, isAuthenticated: true }),

  setAccessToken: (accessToken) => set({ accessToken, isAuthenticated: true }),

  clearSession: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));
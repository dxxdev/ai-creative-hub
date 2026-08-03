/**
 * Muvaffaqiyatli login/register'dan keyin API qaytaradigan token juftligi.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** accessToken tugash vaqti (Unix timestamp, millisekundda) */
  expiresAt: number;
}

/**
 * Login/register endpoint'ining to'liq javob shakli.
 */
export interface AuthResponse {
  user: import("./user.js").PublicUser;
  tokens: AuthTokens;
}
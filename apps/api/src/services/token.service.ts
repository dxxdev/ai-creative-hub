import jwt, { SignOptions } from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET as string;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error(
    'JWT_ACCESS_SECRET va JWT_REFRESH_SECRET .env faylida aniqlanishi shart'
  );
}

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export interface TokenPayload {
  userId: string;
  email: string;
}

/**
 * Qisqa muddatli access token (15 daqiqa).
 * API so'rovlarini avtorizatsiya qilish uchun ishlatiladi.
 */
export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_EXPIRES_IN };
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, options);
}

/**
 * Uzoq muddatli refresh token (30 kun).
 * Yangi access token olish uchun ishlatiladi.
 */
export function generateRefreshToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRES_IN };
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, options);
}

/**
 * Bir vaqtda ikkala tokenni generatsiya qilish uchun qulay helper.
 */
export function generateTokenPair(payload: TokenPayload): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
}
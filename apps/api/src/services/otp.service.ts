import { randomInt } from "node:crypto";
import { redis } from "../lib/redis.js";

/** OTP kodi Redis'da necha soniya saqlanishi (10 daqiqa) */
const OTP_TTL_SECONDS = 600;

/** Redis kalitini "email_verify:{userId}" formatida yasaydi */
function buildEmailVerifyKey(userId: string): string {
  return `email_verify:${userId}`;
}

/**
 * 6 xonali tasodifiy OTP kod generatsiya qiladi (000000–999999 oralig'ida,
 * har doim 6 ta raqamdan iborat bo'lishi uchun boshidagi nollar saqlanadi).
 * Kriptografik jihatdan xavfsiz `crypto.randomInt` ishlatiladi.
 */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Berilgan foydalanuvchi uchun yangi OTP generatsiya qiladi va uni
 * Redis'da "email_verify:{userId}" kaliti ostida 600 soniya (10 daqiqa)
 * TTL bilan saqlaydi. Generatsiya qilingan kodni qaytaradi (masalan,
 * email orqali yuborish uchun).
 */
export async function createEmailVerificationOtp(userId: string): Promise<string> {
  const otp = generateOtp();
  const key = buildEmailVerifyKey(userId);

  // "EX" — soniyalarda TTL o'rnatadi, kalit muddati tugagach avtomatik o'chadi
  await redis.set(key, otp, "EX", OTP_TTL_SECONDS);

  return otp;
}

/**
 * Berilgan foydalanuvchi uchun Redis'da saqlangan OTP kodni o'qiydi.
 * Kalit topilmasa (muddati tugagan yoki umuman yaratilmagan) `null` qaytaradi.
 */
export async function getEmailVerificationOtp(userId: string): Promise<string | null> {
  return redis.get(buildEmailVerifyKey(userId));
}

/**
 * Foydalanuvchi kiritgan OTP kodni Redis'dagi kod bilan solishtiradi.
 * To'g'ri bo'lsa, kalitni Redis'dan o'chirib (bir martalik ishlatilish
 * uchun) `true` qaytaradi; aks holda `false` qaytaradi.
 */
export async function verifyEmailOtp(userId: string, code: string): Promise<boolean> {
  const key = buildEmailVerifyKey(userId);
  const storedOtp = await redis.get(key);

  if (!storedOtp || storedOtp !== code) {
    return false;
  }

  await redis.del(key);
  return true;
}
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { Request } from 'express';
import { redis } from '../lib/redis.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 daqiqa
const MAX_ATTEMPTS = 5;

// * Xato email yoki parol bilan kirish so'rovlari haddan tashqari ko'pligi serverga yuklama
// TODO shuning uchun ketma-ket xato so'rovlarga cheklov qo'yildi

function loginRateLimitKey(req: Request): string {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : 'unknown';
  // MUHIM: req.ip'ni to'g'ridan-to'g'ri ishlatib bo'lmaydi — IPv6 manzillar
  // (masalan localhost'dagi "::1") to'g'ri normalizatsiya qilinmasa, bitta
  // foydalanuvchi turli IPv6 manzillar orqali cheklovni chetlab o'tishi mumkin.
  // express-rate-limit shuni tekshirib, ipKeyGenerator() ishlatilmasa xato
  // uloqtiradi (ERR_ERL_KEY_GEN_IPV6) — bu esa server ishga tushishida
  // (rateLimit() chaqirilganda) butun process'ni yiqitadi.
  return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
}

export const loginRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_ATTEMPTS,
  standardHeaders: true, // RateLimit-* header'larini javobga qo'shadi
  legacyHeaders: false,  // eskirgan X-RateLimit-* header'larini o'chiradi
  keyGenerator: loginRateLimitKey,
  store: new RedisStore({
    // @ts-expect-error - rate-limit-redis ioredis'ning sendCommand'ini shu formatda kutadi
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: 'login_rl:',
  }),
  handler: (req, res) => {
    res.status(429).json({
      error: "Juda ko'p urinish. Iltimos, 15 daqiqadan keyin qayta urinib ko'ring",
    });
  },
});
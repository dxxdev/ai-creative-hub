import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

if (!process.env.REDIS_URL) {
  console.warn(
    "⚠️  Redis: REDIS_URL .env faylida topilmadi, standart manzil ishlatilmoqda: redis://localhost:6379"
  );
}

/**
 * Butun ilova bo'ylab ishlatiladigan yagona (singleton) Redis client.
 * Masalan: sessiyalarni keshlash, rate-limiting, tokenlarni vaqtinchalik saqlash uchun.
 */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    // Har bir urinishda kutish vaqtini oshiradi, 2 soniyada to'xtaydi
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("🔌 Redis: TCP ulanish o'rnatildi");
});

redis.on("ready", () => {
  console.log("✅ Redis: client tayyor (ready)");
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis ulanish xatosi:", err.message);
});

redis.on("close", () => {
  console.warn("⚠️  Redis: ulanish yopildi");
});

redis.on("reconnecting", (delay: number) => {
  console.warn(`🔁 Redis: qayta ulanishga urinilmoqda (${delay}ms dan keyin)`);
});

redis.on("end", () => {
  console.warn("🛑 Redis: ulanish butunlay tugatildi, qayta urinish yo'q");
});

export default redis;
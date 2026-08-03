import "dotenv/config";
import { z } from "zod";

/**
 * Barcha environment o'zgaruvchilari shu yerda e'lon qilinadi va Zod orqali
 * qat'iy tekshiriladi. Agar biror maydon noto'g'ri yoki yetishmasa, server
 * ISHGA TUSHISHDAN OLDIN (boot vaqtida) xato berib to'xtaydi — bu noto'g'ri
 * konfiguratsiya bilan production'ga chiqib ketishning oldini oladi.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL .env faylida ko'rsatilishi shart" })
    .url("DATABASE_URL to'g'ri PostgreSQL ulanish URL'i bo'lishi kerak"),

  JWT_ACCESS_SECRET: z
    .string({ required_error: "JWT_ACCESS_SECRET .env faylida ko'rsatilishi shart" })
    .min(16, "JWT_ACCESS_SECRET kamida 16 belgidan iborat bo'lishi kerak"),

  JWT_REFRESH_SECRET: z
    .string({ required_error: "JWT_REFRESH_SECRET .env faylida ko'rsatilishi shart" })
    .min(16, "JWT_REFRESH_SECRET kamida 16 belgidan iborat bo'lishi kerak"),

  REDIS_URL: z
    .string({ required_error: "REDIS_URL .env faylida ko'rsatilishi shart" })
    .url("REDIS_URL to'g'ri Redis ulanish URL'i bo'lishi kerak"),

  SMTP_HOST: z
    .string({ required_error: "SMTP_HOST .env faylida ko'rsatilishi shart" })
    .min(1, "SMTP_HOST bo'sh bo'lmasligi kerak"),

  SMTP_PORT: z.coerce
    .number({ required_error: "SMTP_PORT .env faylida ko'rsatilishi shart" })
    .int()
    .positive(),

  SMTP_USER: z
    .string({ required_error: "SMTP_USER .env faylida ko'rsatilishi shart" })
    .min(1, "SMTP_USER bo'sh bo'lmasligi kerak"),

  SMTP_PASS: z
    .string({ required_error: "SMTP_PASS .env faylida ko'rsatilishi shart" })
    .min(1, "SMTP_PASS bo'sh bo'lmasligi kerak"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Environment o'zgaruvchilari noto'g'ri sozlangan:\n");

    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "(noma'lum maydon)";
      console.error(`  • ${field}: ${issue.message}`);
    }

    console.error(
      "\nIltimos, .env faylini apps/api/.env.example namunasiga qarab to'g'irlang.\n"
    );

    process.exit(1);
  }

  return result.data;
}

/**
 * Tasdiqlangan, to'liq tiplashtirilgan environment konfiguratsiyasi.
 * Ilova bo'ylab process.env o'rniga shu obyektni ishlating.
 */
export const env = loadEnv();

export const isDevelopment = env.NODE_ENV === "development";
export const isStaging = env.NODE_ENV === "staging";
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
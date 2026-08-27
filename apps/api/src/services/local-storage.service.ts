import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

/**
 * LOKAL DISK SAQLASH SERVISI
 *
 * Hech qanday bulut saqlash xizmati (S3/R2/GCS) ishlatilmaydi — yuklangan
 * fayllar apps/api/storage/uploads/{userId}/ papkasida saqlanadi va
 * server.ts'da ulangan express.static middleware orqali
 * PUBLIC_UPLOAD_BASE_URL (masalan /uploads) yo'li bilan xizmat qilinadi.
 */

// UPLOAD_DIR .env'da nisbiy (masalan "./storage/uploads") yoki absolyut
// bo'lishi mumkin; process.cwd() = apps/api paketining ildiz papkasi
// (npm/pnpm skriptlar shu yerdan ishga tushiriladi).
export const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);

/**
 * Berilgan userId uchun yuklash papkasini (agar mavjud bo'lmasa) yaratadi
 * va uning absolyut diskdagi yo'lini qaytaradi.
 *
 * Papka tuzilishi: {UPLOAD_ROOT}/{userId}/
 */
export async function ensureUserUploadDir(userId: string): Promise<string> {
  const safeUserId = assertSafePathSegment(userId, "userId");
  const userDir = path.join(UPLOAD_ROOT, safeUserId);

  await mkdir(userDir, { recursive: true });

  return userDir;
}

/**
 * Yuklangan fayl uchun xavfsiz, unique (taqribiy to'qnashuvsiz) fayl nomini
 * generatsiya qiladi: {uuid}{original-kengaytma}.
 *
 * Original fayl nomining o'zi (foydalanuvchi kiritgan matn) hech qachon
 * diskka yozilmaydi — faqat kengaytma undan ajratib olinadi va kichik
 * harflarga o'tkaziladi. Bu path traversal (masalan "../../etc/passwd")
 * va xavfli belgilar (bo'sh joy, unicode, maxsus belgilar) muammosining
 * oldini oladi.
 */
export function generateFileName(originalName: string): string {
  const ext = sanitizeExtension(path.extname(originalName));
  return `${randomUUID()}${ext}`;
}

/**
 * Diskdagi absolyut fayl yo'lini (mediaPath/thumbnailPath sifatida DB'ga
 * yoziladigan, UPLOAD_ROOT'ga nisbatan NISBIY yo'lga aylantiradi.
 * Masalan: "{userId}/xyz.png"
 */
export function toRelativeStoragePath(absoluteFilePath: string): string {
  return path.relative(UPLOAD_ROOT, absoluteFilePath).split(path.sep).join("/");
}

/**
 * DB'da saqlangan nisbiy disk yo'lini (masalan "{userId}/xyz.png")
 * clientga ko'rsatiladigan public URL'ga aylantiradi (masalan
 * "/uploads/{userId}/xyz.png"). apps/web shu URL'ni to'g'ridan-to'g'ri
 * <img src> yoki <a href> sifatida ishlatadi.
 */
export function toPublicUploadUrl(relativeStoragePath: string): string {
  const normalized = relativeStoragePath.split(path.sep).join("/").replace(/^\/+/, "");
  return `${env.PUBLIC_UPLOAD_BASE_URL.replace(/\/+$/, "")}/${normalized}`;
}

/**
 * userId kabi segmentlarni disk yo'liga qo'shishdan oldin tekshiradi —
 * faqat harf/raqam/tire/pastki chiziqqa ruxsat beriladi, shu bilan
 * path traversal ("..", "/", "\\") imkoniyatini butunlay yopadi.
 */
function assertSafePathSegment(value: string, fieldName: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${fieldName} xavfsiz disk yo'li segmenti emas: "${value}"`);
  }
  return value;
}

/**
 * Fayl kengaytmasini xavfsiz shaklga keltiradi: kichik harflarga
 * o'tkaziladi, faqat harf/raqamlarga ruxsat beriladi (masalan ".PNG" ->
 * ".png"). Kengaytma bo'lmasa yoki noto'g'ri bo'lsa, kengaytmasiz qaytadi.
 */
function sanitizeExtension(ext: string): string {
  const cleaned = ext.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return /^\.[a-z0-9]+$/.test(cleaned) ? cleaned : "";
}

/**
 * DB'da saqlangan nisbiy disk yo'lini (masalan "{userId}/xyz.png")
 * to'liq absolyut fayl yo'liga aylantiradi — diskdan o'qish/yozish
 * uchun ishlatiladi. toRelativeStoragePath'ning teskarisi.
 */
export function toAbsoluteStoragePath(relativeStoragePath: string): string {
  return path.join(UPLOAD_ROOT, relativeStoragePath);
}

/**
 * DB'da saqlangan nisbiy disk yo'li (masalan Post.mediaPath) bo'yicha
 * faylni diskdan Buffer sifatida o'qiydi. Worker'lar (masalan
 * image-processing.worker.ts) asl faylni qayta ishlashdan oldin shu
 * funksiya orqali o'qiydi.
 */
export async function readStorageFile(relativeStoragePath: string): Promise<Buffer> {
  return readFile(toAbsoluteStoragePath(relativeStoragePath));
}
// apps/web/lib/validators.ts
/**
 * apps/web/lib/validators.ts
 *
 * Fayl yuklashdan OLDIN, clientda tezkor tekshiruv uchun ishlatiladi.
 *
 * MUHIM: bu backend validatsiyasini (apps/api/src/controllers/media.controller.ts
 * dagi multer fileFilter + limits.fileSize) ALMASHTIRMAYDI — u yerdagi
 * tekshiruv hamon yakuniy, xavfsizlik nuqtai nazaridan ishonchli manba
 * hisoblanadi (client tomonidagi tekshiruvni chetlab o'tish oson).
 * Bu funksiya faqat foydalanuvchiga notog'ri faylni serverga yubormasdan
 * TEZROQ fikr-mulohaza (feedback) berish uchun.
 *
 * Ruxsat etilgan turlar va hajm chegarasi ataylab backend bilan bir xil
 * qilib qo'yilgan (ALLOWED_MIME_TYPES / MAX_FILE_SIZE_BYTES,
 * media.controller.ts'ga qarang), shunda foydalanuvchi ikkala tomonda
 * ham bir xil qoidaga duch keladi.
 */

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface ValidateImageFileResult {
  valid: boolean;
  /** Tekshiruv muvaffaqiyatsiz bo'lsa, foydalanuvchiga ko'rsatsa bo'ladigan tushunarli xabar. */
  error?: string;
}

/**
 * Fayl turini (faqat JPG/JPEG, PNG, WEBP) va hajmini (max 10MB)
 * tekshiradi.
 *
 * @example
 * const result = validateImageFile(file);
 * if (!result.valid) {
 *   setError(result.error);
 *   return;
 * }
 * await uploadFileToServer(file, { ... });
 */
export function validateImageFile(file: File): ValidateImageFileResult {
  const isAllowedType = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);

  if (!isAllowedType) {
    return {
      valid: false,
      error: "Faqat JPG, PNG yoki WebP formatlar qo'llab-quvvatlanadi",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Fayl hajmi 10MB dan oshmasligi kerak",
    };
  }

  return { valid: true };
}
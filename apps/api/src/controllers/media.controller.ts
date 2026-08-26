import type { Request, Response, NextFunction } from "express";
import multer, { type FileFilterCallback } from "multer";
import { AppError } from "../utils/AppError.js";
import {
  ensureUserUploadDir,
  generateFileName,
  toPublicUploadUrl,
  toRelativeStoragePath,
} from "../services/local-storage.service.js";

// ---------------------------------------------------------------------------
// MULTER KONFIGURATSIYASI
// Fayl to'g'ridan-to'g'ri diskka (storage/uploads/{userId}/) yoziladi —
// xotirada (memoryStorage) saqlanmaydi, shuning uchun katta fayllar ham
// RAM'ni band qilmaydi.
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const diskStorage = multer.diskStorage({
  // MUHIM: authGuard bu middleware'dan OLDIN ishga tushishi shart,
  // aks holda req.user hali mavjud bo'lmaydi (route faylida ta'minlanadi).
  destination: (req, _file, cb) => {
    const userId = req.user?.userId;

    if (!userId) {
      cb(new AppError("Avtorizatsiyadan o'tilmagan", 401), "");
      return;
    }

    ensureUserUploadDir(userId)
      .then((dir) => cb(null, dir))
      .catch((error) => cb(error as Error, ""));
  },
  filename: (_req, file, cb) => {
    cb(null, generateFileName(file.originalname));
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const isAllowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype);

  if (!isAllowed) {
    cb(new AppError("Faqat JPG, JPEG, PNG yoki WEBP formatidagi rasmlarga ruxsat beriladi", 400));
    return;
  }

  cb(null, true);
}

const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

/**
 * multer'ning upload.single("file") middleware'ini o'raydi va uning
 * xatolarini (MulterError yoki fileFilter'dan kelgan AppError) global
 * errorHandler tushunadigan bir xil AppError ko'rinishiga keltiradi —
 * shu bilan errorHandler.middleware.ts'ga tegmasdan to'g'ri statusKod
 * (400) va tushunarli xabar qaytariladi.
 */
export function uploadSingleImage(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(new AppError("Fayl hajmi 10MB dan oshmasligi kerak", 400));
        return;
      }
      next(new AppError(`Fayl yuklashda xatolik: ${err.message}`, 400));
      return;
    }

    if (err) {
      next(err);
      return;
    }

    next();
  });
}

// POST /media/upload — authGuard + uploadSingleImage route'da bajariladi
export async function uploadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      next(new AppError("Fayl topilmadi ('file' maydoni majburiy)", 400));
      return;
    }

    const relativePath = toRelativeStoragePath(req.file.path);
    const publicUrl = toPublicUploadUrl(relativePath);

    // V1: fileId sifatida diskdagi nisbiy yo'lning o'zi ishlatiladi.
    // Post yaratishda (CreatePostSchema.fileId) shu qiymat orqali fayl
    // topiladi va Post.mediaPath'ga ko'chiriladi/bog'lanadi.
    const fileId = relativePath;

    res.status(201).json({
      success: true,
      data: { fileId, publicUrl },
    });
  } catch (error) {
    next(error);
    return;
  }
}
import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

// validateSchema.ts'ning lokal (faqat /posts uchun) nusxasi — farqi:
// muvaffaqiyatsiz javobga success: false ham qo'shadi
export function validatePostsSchema(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Yuborilgan ma'lumotlar noto'g'ri",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

// posts.routes.ts router'ining OXIRIDA ro'yxatdan o'tkaziladigan
// xato-ushlovchi middleware (4 argumentli) — shu router ichidagi
// next(error)'larni global errorHandler'ga yetkazmasdan ushlaydi
export function postsErrorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ success: false, error: "Validatsiya xatosi", details: err.issues });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ success: false, error: "Serverda kutilmagan xatolik" });
}
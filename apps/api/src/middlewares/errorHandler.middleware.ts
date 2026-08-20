import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";
import { ZodError } from "zod";

/**
 * Barcha route/middleware'lardan o'tib kelgan xatolarni ushlab,
 * xavfsiz (stack trace'siz) javob qaytaradigan global error handler.
 * MUHIM: Express bu funksiyani error-middleware sifatida tanishi
 * uchun 4 ta parametr bo'lishi shart.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validatsiya xatosi",
      details: err.issues,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Serverda kutilmagan xatolik" });
}
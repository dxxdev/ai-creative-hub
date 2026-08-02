import type { Request, Response, NextFunction } from "express";

/**
 * Barcha route/middleware'lardan o'tib kelgan xatolarni ushlab, foydalanuvchiga
 * xavfsiz (stack trace'siz) javob qaytaradigan global error handler.
 * MUHIM: Express bu funksiyani error-middleware sifatida tanishi uchun 4 ta
 * parametr bo'lishi shart.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);
  res.status(500).json({ error: "Serverda kutilmagan xatolik" });
}
import type { Request, Response } from "express";

/**
 * Hech qanday route mos kelmagan so'rovlar uchun 404 javob qaytaradi.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route topilmadi" });
}
import type { Request, Response } from "express";

/**
 * GET /health — server holatini tekshirish uchun oddiy endpoint.
 */
export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({ status: "ok", service: "ai-creative-hub-api" });
}
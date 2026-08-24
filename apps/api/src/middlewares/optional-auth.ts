import type { Request, Response, NextFunction } from "express";

// req.user bo'lsa to'ldiradi, bo'lmasa xatosiz o'tkazib yuboradi
// (PUBLIC/UNLISTED postlarni anonim foydalanuvchi ham ko'ra olishi kerak)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // TODO: token mavjud bo'lsa decode qiling va req.user ni to'ldiring
  next();
}
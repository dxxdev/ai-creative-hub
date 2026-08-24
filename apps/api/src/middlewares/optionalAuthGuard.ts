import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service.js';

/**
 * authGuard bilan bir xil tokenni tekshiradi, lekin token yo'q yoki yaroqsiz
 * bo'lsa so'rovni to'xtatmaydi — shunchaki req.user aniqlanmagan qoladi.
 *
 * PUBLIC/UNLISTED postlarni anonim foydalanuvchi ham ko'ra olishi, lekin
 * PRIVATE postni faqat muallif ko'rishi kerak bo'lgan route'larda ishlatiladi
 * (masalan GET /api/posts, GET /api/posts/:id).
 */
export function optionalAuthGuard(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return next();
  }

  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Yaroqsiz/eskirgan token — anonim foydalanuvchi sifatida davom etamiz
  }

  next();
}
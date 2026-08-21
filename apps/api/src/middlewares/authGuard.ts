import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../services/token.service.js';

export function authGuard(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Avtorizatsiya sarlavhasi topilmadi', 401));
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    return next(new AppError('Access token topilmadi', 401));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return next(new AppError('Access token yaroqsiz yoki muddati tugagan', 401));
  }
}
import { Request, Response, NextFunction } from 'express';
import { logout } from '../../services/auth.service.js';

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await logout(refreshToken);
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
    });

    return res.status(200).json({
      success: true,
      message: 'Tizimdan muvaffaqiyatli chiqdingiz',
    });
  } catch (error) {
    next(error);
  }
}
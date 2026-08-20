import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';
import { refreshAccessToken } from '../../services/auth.service.js';

export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError('Refresh token topilmadi', 401);
    }

    const { accessToken } = await refreshAccessToken(refreshToken);

    return res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
}
import { Request, Response, NextFunction } from 'express';
import { login } from '../../services/auth.service.js';

const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await login(req.body, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
      path: "/api/auth"
    })

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}
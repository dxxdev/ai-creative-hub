import { Request, Response, NextFunction } from 'express';
import { login } from '../../services/auth.service.js';

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await login(req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
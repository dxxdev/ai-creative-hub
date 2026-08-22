import { Request, Response, NextFunction } from 'express';
import { resetPassword } from '../../services/auth.service.js';

export async function resetPasswordController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await resetPassword(req.body);

    return res.status(200).json({
      success: true,
      message: "Parol muvaffaqiyatli yangilandi",
    });
  } catch (error) {
    next(error);
  }
}
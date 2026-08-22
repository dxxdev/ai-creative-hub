import { Request, Response, NextFunction } from 'express';
import { forgotPassword } from '../../services/auth.service.js';

export async function forgotPasswordController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await forgotPassword(req.body.email);

    // Email mavjud yoki yo'qligidan qat'iy nazar — bir xil javob
    return res.status(200).json({
      success: true,
      message: "Agar bu email mavjud bo'lsa, xat yuborildi",
    });
  } catch (error) {
    next(error);
  }
}
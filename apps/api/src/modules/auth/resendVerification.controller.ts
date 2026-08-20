import { Request, Response, NextFunction } from 'express';
import { resendVerificationSchema } from '@repo/shared';
import { resendVerification } from './resendVerification.service.js';

export async function resendVerificationController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email } = resendVerificationSchema.parse(req.body);

    const result = await resendVerification(email);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyOtpAndActivateUser } from './verifyOtp.service.js';

const verifyOtpSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().length(6),
});

export async function verifyOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { userId, otp } = verifyOtpSchema.parse(req.body);

    const result = await verifyOtpAndActivateUser({ userId, otp });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
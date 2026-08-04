import type { Request, Response } from "express";
import type { RegisterInput } from "@repo/shared";
import { registerUser, EmailAlreadyExistsError } from "../services/auth.service.js";
import { createEmailVerificationOtp } from "../services/otp.service.js";
import { queueOtpEmail } from "../queues/email.queue.js";
import type { VerifyEmailInput } from "@repo/shared";
import {
  verifyUserEmail,
  UserNotFoundError,
  EmailAlreadyVerifiedError,
  InvalidOrExpiredOtpError,
} from "../services/auth.service.js";

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as RegisterInput;

  try {
    const user = await registerUser({
      email: body.email,
      password: body.password,
    });

    // OTP kodni Redis'da saqlaymiz, lekin emailni bu yerda TO'G'RIDAN-TO'G'RI
    // yubormaymiz — buning o'rniga "email" queue'ga job qo'shamiz, shunda
    // SMTP javobini kutish HTTP so'rovini sekinlashtirmaydi (worker fon
    // rejimida qayta ishlaydi).
    const otp = await createEmailVerificationOtp(user.id);
    await queueOtpEmail(user.email, otp);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    if (err instanceof EmailAlreadyExistsError) {
      res.status(409).json({ error: err.message });
      return;
    }

    console.error("Register xatosi:", err);
    res.status(500).json({ error: "Ro'yxatdan o'tishda kutilmagan xatolik yuz berdi" });
  }
}

export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as VerifyEmailInput;

  try {
    const user = await verifyUserEmail({
      email: body.email,
      otpCode: body.otpCode,
    });

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status,
      },
    });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }

    if (err instanceof EmailAlreadyVerifiedError) {
      res.status(409).json({ error: err.message });
      return;
    }

    if (err instanceof InvalidOrExpiredOtpError) {
      res.status(400).json({ error: err.message });
      return;
    }

    console.error("Emailni tasdiqlash xatosi:", err);
    res.status(500).json({ error: "Emailni tasdiqlashda kutilmagan xatolik yuz berdi" });
  }
}
import type { Request, Response } from "express";
import type { RegisterInput } from "@repo/shared";
import { registerUser, EmailAlreadyExistsError } from "../services/auth.service.js";

// Bu handler faqat validateSchema(RegisterSchema) middleware'idan o'tgandan
// keyin ishga tushadi, shuning uchun req.body allaqachon RegisterInput shakliga mos.
export async function registerHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as RegisterInput;

  try {
    const user = await registerUser({
      email: body.email,
      password: body.password,
    });

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
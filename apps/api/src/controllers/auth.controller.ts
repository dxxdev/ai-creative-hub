import type { Request, Response } from "express";
import { RegisterSchema } from "@repo/shared";
import { registerUser, EmailAlreadyExistsError } from "../services/auth.service.js";

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const user = await registerUser({
      email: parsed.data.email,
      password: parsed.data.password,
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
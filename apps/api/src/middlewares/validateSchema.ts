import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

/**
 * Berilgan Zod sxemasi bo'yicha req.body'ni tekshiruvchi umumiy Express middleware.
 *
 * - Validatsiyadan o'tsa: req.body sxema orqali parse qilingan (masalan, default
 *   qiymatlar qo'shilgan, ortiqcha maydonlar olib tashlangan) qiymat bilan
 *   almashtiriladi va keyingi middleware/controller'ga o'tkaziladi.
 * - Validatsiyadan o'tmasa: 400 status va har bir maydon bo'yicha aniq xato
 *   xabarlari bilan javob qaytariladi, so'rov keyingi bosqichga o'tkazilmaydi.
 *
 * Ishlatilishi:
 *   router.post("/register", validateSchema(RegisterSchema), registerHandler);
 */
export function validateSchema(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Yuborilgan ma'lumotlar noto'g'ri",
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    req.body = parsed.data;
    next();
  };
}
import { z } from "zod";

/**
 * Ro'yxatdan o'tish (register) so'rovi uchun Zod sxemasi.
 * - email: to'g'ri email formatida bo'lishi shart
 * - password: kamida 8 belgi, kamida 1 katta harf, 1 raqam, 1 maxsus belgi
 * - confirmPassword: password bilan aynan mos kelishi shart
 */
export const RegisterSchema = z
  .object({
    email: z.string().email("Email manzili noto'g'ri formatda"),
    password: z
      .string()
      .min(8, "Parol kamida 8 belgidan iborat bo'lishi kerak")
      .regex(/[A-Z]/, "Parolda kamida 1 ta katta harf bo'lishi kerak")
      .regex(/[0-9]/, "Parolda kamida 1 ta raqam bo'lishi kerak")
      .regex(/[^A-Za-z0-9]/, "Parolda kamida 1 ta maxsus belgi bo'lishi kerak"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Parollar bir-biriga mos kelmadi",
    path: ["confirmPassword"],
  });

export const VerifyEmailSchema = z.object({
  email: z.string().email("Email manzili noto'g'ri formatda"),
  otpCode: z
    .string()
    .length(6, "Tasdiqlash kodi aynan 6 xonadan iborat bo'lishi kerak")
    .regex(
      /^\d{6}$/,
      "Tasdiqlash kodi faqat raqamlardan iborat bo'lishi kerak",
    ),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export type RegisterInput = z.infer<typeof RegisterSchema>;

// TODO: Login so'rov sxemasi shu yerga qo'shiladi
// Masalan: export const LoginSchema = z.object({ ... });

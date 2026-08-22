import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { Router } from "express";
import request from "supertest";

vi.mock("../services/auth.service.js", () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from "../services/auth.service.js";
import { AppError } from "../utils/AppError.js";
import { validateSchema } from "../middlewares/validateSchema.js";
import { errorHandler } from "../middlewares/errorHandler.middleware.js";
import { resetPasswordSchema } from "@repo/shared";
import { resetPasswordController } from "../modules/auth/resetPassword.controller.js";

// E'tibor: bu yerda butun auth.routes.ts o'rniga faqat reset-password uchun
// mustaqil router yig'ilyapti. auth.routes.ts login/registratsiya kabi
// boshqa modullarni ham import qiladi, ular esa .env orqali sozlanadigan
// Redis/SMTP/JWT kabi servislarga bog'liq — reset-password'ni test qilish
// uchun ularning barchasini yuklashning hojati yo'q.
function buildApp() {
  const app = express();
  app.use(express.json());

  const router = Router();
  router.post(
    "/reset-password",
    validateSchema(resetPasswordSchema),
    resetPasswordController,
  );

  app.use("/api/auth", router);
  app.use(errorHandler);
  return app;
}

// resetPassword() servisi token'ni Redis'dan `password_reset:<token>` kaliti
// bilan qidiradi. Redis'da topilmasa — muddati tugagani uchunmi yoki
// allaqachon ishlatilib o'chirilgani uchunmi — bir xil xato uloqtiriladi:
// AppError("Yaroqsiz yoki muddati o'tgan havola", 400).
const EXPIRED_OR_USED_ERROR = new AppError(
  "Yaroqsiz yoki muddati o'tgan havola",
  400,
);

const VALID_BODY = {
  token: "a".repeat(64), // crypto.randomBytes(32).toString('hex') formatiga o'xshash
  newPassword: "NewPassword1!",
};

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muddati o'tgan (eskirgan) token bilan 400 qaytaradi", async () => {
    vi.mocked(resetPassword).mockRejectedValue(EXPIRED_OR_USED_ERROR);

    const res = await request(buildApp())
      .post("/api/auth/reset-password")
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Yaroqsiz yoki muddati o'tgan havola");
    expect(resetPassword).toHaveBeenCalledWith(VALID_BODY);
  });

  it("allaqachon ishlatilgan token bilan 400 qaytaradi", async () => {
    // Birinchi so'rov: token haqiqiy va hali Redis'da bor — muvaffaqiyatli
    // parolni yangilaydi; resetPassword() ichida token bir martalik
    // bo'lgani uchun Redis'dan o'chiriladi.
    vi.mocked(resetPassword).mockResolvedValueOnce(undefined);

    const firstRes = await request(buildApp())
      .post("/api/auth/reset-password")
      .send(VALID_BODY);

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    // Ikkinchi so'rov: aynan o'sha token yana yuboriladi. Token endi
    // Redis'da yo'q, shuning uchun servis uni "yaroqsiz" deb topadi —
    // eskirgan tokendagi bilan bir xil xato qaytadi.
    vi.mocked(resetPassword).mockRejectedValueOnce(EXPIRED_OR_USED_ERROR);

    const secondRes = await request(buildApp())
      .post("/api/auth/reset-password")
      .send(VALID_BODY);

    expect(secondRes.status).toBe(400);
    expect(secondRes.body.error).toBe("Yaroqsiz yoki muddati o'tgan havola");
    expect(resetPassword).toHaveBeenCalledTimes(2);
  });

  it("bo'sh (noto'g'ri formatdagi) token bilan 400 qaytaradi va servisga murojaat qilmaydi", async () => {
    const res = await request(buildApp())
      .post("/api/auth/reset-password")
      .send({ ...VALID_BODY, token: "" });

    expect(res.status).toBe(400);
    expect(res.body.errors.token).toBeDefined();
    expect(res.body.errors.token[0]).toMatch(/token/i);
    // Zod validatsiyasidan o'tmagani uchun so'rov servisga umuman yetib bormasligi kerak
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("token maydoni noto'g'ri turda (string emas) bo'lganda ham 400 qaytaradi", async () => {
    const res = await request(buildApp())
      .post("/api/auth/reset-password")
      .send({ ...VALID_BODY, token: 12345 });

    expect(res.status).toBe(400);
    expect(res.body.errors.token).toBeDefined();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
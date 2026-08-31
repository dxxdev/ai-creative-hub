import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";

// MUHIM: bu qator BOSHQA HAMMA IMPORTDAN OLDIN turishi shart.
// `token.service.ts` (JWT generatsiya qiluvchi fayl) modul yuklanishi
// bilanoq `process.env.JWT_ACCESS_SECRET`ni to'g'ridan-to'g'ri o'qiydi
// (markazlashtirilgan `config/env.ts` orqali emas). Quyida import
// qilinadigan `./posts.routes.js` zanjiri orqali (authGuard.js →
// token.service.js) shu tekshiruv ILGARIROQ ishga tushadi — agar
// `.env` hali yuklanmagan bo'lsa (ya'ni shu qator bo'lmasa), u
// "JWT_ACCESS_SECRET va JWT_REFRESH_SECRET .env faylida aniqlanishi
// shart" xatosini beradi. Shu import ATAYLAB birinchi qator sifatida
// qo'yilgan — shunda `.env` boshqa har qanday moduldan oldin yuklanadi.
import "dotenv/config";

/**
 * apps/api/src/routes/posts.routes.test.ts
 *
 * MUHIM — bu fayl boshqa route testlaridan (auth.route.test.ts,
 * resetPassword.route.test.ts) TUBDAN FARQ QILADI: ular servis
 * qatlamini (`vi.mock`) to'liq soxtalashtiradi, bu yerda esa — sizning
 * so'rovingizga ko'ra — HAQIQIY Prisma klienti va HAQIQIY Postgres
 * bilan ishlaymiz (hech narsa mock qilinmagan). Sabab: shu orqali
 * butun zanjir — route → authGuard → validatePostsSchema →
 * posts.controller → posts.service (tag upsert, $transaction) → DB —
 * chindan ham to'g'ri ulanganini tekshirish mumkin.
 *
 * ⚠️ ALOHIDA TEST DB SHART. Bu test haqiqiy `INSERT`/`DELETE`
 * so'rovlarini yuboradi. `config/env.ts` `dotenv/config` orqali
 * `.env`ni o'qiydi, LEKIN process.env'da allaqachon mavjud
 * o'zgaruvchini USTIDAN YOZMAYDI — shuning uchun buni development
 * bazangizga tegmasdan, alohida test bazasiga yo'naltirish uchun,
 * shu faylni ishga tushirishdan oldin DATABASE_URL'ni qobiqda
 * (shell'da) berib qo'ying:
 *
 *   DATABASE_URL="postgresql://user:pass@localhost:5432/ai_creative_hub_test" \
 *     pnpm vitest run src/routes/posts.routes.test.ts
 *
 * (Test bazasida ham `pnpm prisma migrate deploy` bilan sxema
 * tayyor turishi kerak.) Test o'zi yaratgan yozuvlarni (`afterAll`da)
 * tozalaydi, lekin baribir DEV bazangizga tasodifan ishga
 * tushirmaslik uchun alohida baza ishlatish tavsiya etiladi.
 *
 * NEGA TRANZAKSIYA-ROLLBACK STRATEGIYASI EMAS, ALOHIDA DB TANLANDI:
 * odatiy "har testni $transaction ichida ochib, oxirida throw bilan
 * rollback qilish" usuli bu loyihada ishlamaydi — `posts.service.ts`
 * ichidagi `createPost()`ning o'zi allaqachon `prisma.$transaction()`
 * ochadi, Prisma esa BITTA ulanish ichida ICHKI (nested) interactive
 * tranzaksiyani qo'llab-quvvatlamaydi. Shuning uchun bu yerda oddiyroq
 * va ishonchli yondashuv — alohida test DB + testlar tugagach
 * o'zi yaratgan yozuvlarni aniq ID/nom bo'yicha o'chirish — tanlandi.
 */

import postsRoutes from "./posts.routes.js";
import { errorHandler } from "../middlewares/errorHandler.middleware.js";
import { prisma } from "../lib/prisma.js";
import { generateAccessToken } from "../services/token.service.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/posts", postsRoutes);
  app.use(errorHandler); // postsRoutes ichidagi postsErrorHandler'dan keyingi umumiy xavfsizlik to'ri
  return app;
}

const app = buildApp();

// Har test yugurishida (parallel/qayta-qayta ishga tushirilganda ham)
// to'qnashmasligi uchun email/username/tag nomiga tasodifiy suffiks
// qo'shiladi.
const runSuffix = randomUUID().slice(0, 8);

describe("POST /posts va GET /posts/:id (integratsiya, haqiqiy DB)", () => {
  let testUserId = "";
  let accessToken = "";
  const createdPostIds: string[] = [];
  const createdTagName = `test-tag-${runSuffix}`;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `posts-route-test-${runSuffix}@example.test`,
        username: `posts_test_${runSuffix}`,
        // Haqiqiy parol bilan login qilinmaydi — faqat FK/NOT NULL
        // talabini qondirish uchun.
        passwordHash: "not-used-in-this-test",
        status: "ACTIVE",
      },
    });
    testUserId = user.id;
    accessToken = generateAccessToken({ userId: user.id, email: user.email });
  });

  afterAll(async () => {
    // Tartib muhim: avval post/tag bog'lanishlari (Post o'chirilganda
    // PostTag @onDelete: Cascade orqali o'zi ketadi), keyin Tag qatori
    // (u Post'ga bog'liq emas, mustaqil o'chiriladi), eng oxirida
    // foydalanuvchi (uning qolgan postlari bo'lsa ham Cascade orqali
    // ketadi — lekin baribir avval aniq ID bo'yicha o'chiramiz, shunda
    // testda biror joyda xato bo'lsa ham iz qolmaydi).
    if (createdPostIds.length > 0) {
      await prisma.post.deleteMany({ where: { id: { in: createdPostIds } } });
    }
    await prisma.tag.deleteMany({ where: { name: createdTagName } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe("avtorizatsiya va validatsiya", () => {
    it("Authorization sarlavhasisiz (tokensiz) so'rov 401 qaytaradi", async () => {
      const res = await request(app).post("/posts").send({
        title: "Token yo'q post",
        contentType: "CODE",
        codeContent: "console.log('salom');",
      });

      expect(res.status).toBe(401);
    });

    it("qo'llab-quvvatlanmaydigan contentType bilan 400 qaytaradi va DB'ga hech narsa yozmaydi", async () => {
      const countBefore = await prisma.post.count({ where: { authorId: testUserId } });

      const res = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Noto'g'ri content turi",
          contentType: "VIDEO", // CreatePostSchema faqat IMAGE/CODE'ni qabul qiladi (V1/MVP)
          codeContent: "bu qabul qilinmaydi",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const countAfter = await prisma.post.count({ where: { authorId: testUserId } });
      expect(countAfter).toBe(countBefore); // haqiqatan ham DB'ga yozilmagan
    });
  });

  // Quyidagi ikki test ATAYLAB bir-biriga bog'liq (create → keyin shu
  // ID bilan read): bu alohida unit emas, balki "post yaratish va uni
  // qayta o'qish" oqimining o'zini tekshiradigan integratsiya ssenariysi.
  describe("CODE post yaratish → GET orqali qaytarib olish", () => {
    let createdPostId = "";
    const codeContent = "function salom() {\n  console.log('salom dunyo');\n}";

    it("to'g'ri CODE post 201 bilan yaratiladi, status='PUBLISHED' va yozuv haqiqatan Postgres'da mavjud bo'ladi", async () => {
      const res = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Salom dunyo funksiyasi",
          contentType: "CODE",
          codeContent,
          codeLanguage: "javascript",
          tags: [createdTagName],
        });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        success: true,
        data: { id: expect.any(String), status: "PUBLISHED" },
      });

      createdPostId = res.body.data.id;
      createdPostIds.push(createdPostId);

      // Controller javobi faqat { id, status } qaytaradi — shuning
      // uchun yozuv chindan ham to'g'ri saqlanganini bevosita
      // Prisma orqali, controller/servisdan mustaqil ravishda
      // tekshiramiz.
      const dbRow = await prisma.post.findUnique({ where: { id: createdPostId } });
      expect(dbRow).toMatchObject({
        authorId: testUserId,
        title: "Salom dunyo funksiyasi",
        contentType: "CODE",
        status: "PUBLISHED",
        codeContent,
      });
    });

    it("yangi yaratilgan postni GET /posts/:id orqali to'liq (title, kod, teglar bilan) qaytarib oladi", async () => {
      // Oldingi test muvaffaqiyatsiz bo'lsa (createdPostId hali bo'sh),
      // shu yerda aniq va tushunarli xato bilan to'xtaymiz.
      expect(createdPostId, "oldingi 'yaratish' testi post ID bermagan").not.toBe("");

      const res = await request(app).get(`/posts/${createdPostId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: createdPostId,
        title: "Salom dunyo funksiyasi",
        contentType: "CODE",
        codeContent,
        codeLanguage: "javascript",
      });
      expect(res.body.data.tags).toContain(createdTagName);
      expect(res.body.data.author).toMatchObject({ id: testUserId });
    });
  });
});
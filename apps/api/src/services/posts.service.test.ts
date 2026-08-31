import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreatePostInput } from "@repo/shared";

/**
 * apps/api/src/services/posts.service.test.ts
 *
 * `createPost()` uchun testlar — real Postgres'ga hech qanday murojaat
 * qilinmaydi, o'rniga `prisma` klienti va uning `$transaction()`ini
 * to'liq mock qilamiz (quyida `createFakeTx()`). Bu shu narsani
 * tekshiradi:
 *   1. IMAGE post → status "PROCESSING" bilan yaratiladi (worker hali
 *      thumbnail generatsiya qilib ulgurmagan).
 *   2. CODE post → status "PUBLISHED" bilan darhol yaratiladi (fon
 *      ishlov shart emas).
 *   3. Yangi tag nomi berilsa — `tag.upsert` "create" yo'li orqali
 *      yangi yozuv sifatida yaratiladi.
 *   4. Mavjud tag nomi qayta berilsa (masalan boshqa post uchun) —
 *      yangi qator yaratilmaydi, bor tag qayta ishlatiladi.
 *
 * `../lib/prisma.js`, `../queues/job-queue.js`,
 * `../queues/image-processing.worker.js`, `./language-detection.service.js`
 * va `./local-storage.service.js` — barchasi `vi.mock` orqali
 * almashtirilgan, shunda `posts.service.ts`ni import qilish hech qanday
 * haqiqiy DB ulanishi, fayl tizimi yoki tashqi kutubxonaga (highlight.js)
 * bog'liq bo'lmaydi.
 */

vi.mock("../lib/prisma.js", () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock("../queues/job-queue.js", () => ({
  enqueue: vi.fn(),
}));

vi.mock("../queues/image-processing.worker.js", () => ({
  IMAGE_PROCESSING_JOB_TYPE: "image-processing",
}));

vi.mock("./language-detection.service.js", () => ({
  detectLanguage: vi.fn(() => "javascript"),
  highlightCode: vi.fn(() => "<pre>mock-highlighted</pre>"),
}));

vi.mock("./local-storage.service.js", () => ({
  toPublicUploadUrl: vi.fn((relativePath: string) => `https://cdn.test/${relativePath}`),
}));

import { prisma } from "../lib/prisma.js";
import { enqueue } from "../queues/job-queue.js";
import { createPost } from "./posts.service.js";

// ---------------------------------------------------------------------------
// Soxta (fake) tranzaksiya klienti — haqiqiy Prisma emas, lekin
// `createPost()` chaqiradigan barcha metodlarni (post.create,
// post.findUniqueOrThrow, tag.upsert, postTag.createMany) real DB kabi
// o'zaro izchil xotirada simulyatsiya qiladi. Shu orqali "mavjud tag
// qayta ishlatiladi" holatini ham haqiqiy DB'siz tekshirish mumkin.
// ---------------------------------------------------------------------------

let postIdSeq = 0;
let tagIdSeq = 0;

/** postId -> post.create() orqali saqlangan xom qator (tags'siz). */
let postsById: Map<string, Record<string, unknown>>;
/** tag nomi -> { id, name } — DB'dagi Tag jadvalini simulyatsiya qiladi. */
let tagsByName: Map<string, { id: string; name: string }>;
/** tagId -> tag nomi — postTag.createMany'da nomni tiklash uchun. */
let tagNameById: Map<string, string>;
/** postId -> unga bog'langan tag nomlari ro'yxati. */
let tagNamesByPostId: Map<string, string[]>;

function createFakeTx() {
  return {
    post: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        postIdSeq += 1;
        const id = `post-${postIdSeq}`;
        const row = {
          id,
          authorId: data.authorId,
          title: data.title,
          description: data.description ?? null,
          contentType: data.codeContent ? "CODE" : "IMAGE",
          visibility: data.visibility ?? "PUBLIC",
          status: data.status,
          mediaPath: data.mediaPath ?? null,
          thumbnailPath: null,
          width: null,
          height: null,
          codeContent: data.codeContent ?? null,
          codeLanguage: data.codeLanguage ?? null,
          codeHighlightHtml: data.codeHighlightHtml ?? null,
          viewCount: 0,
          likeCount: 0,
          remixCount: 0,
          isNsfw: data.isNsfw ?? false,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        };
        postsById.set(id, row);
        return { ...row, tags: [] }; // hali tag biriktirilmagan holat
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = postsById.get(where.id);
        if (!row) throw new Error(`fake tx: post ${where.id} topilmadi`);
        const tagNames = tagNamesByPostId.get(where.id) ?? [];
        return { ...row, tags: tagNames.map((name) => ({ tag: { name } })) };
      }),
    },
    tag: {
      // Haqiqiy Prisma upsert'ga o'xshab: mavjud bo'lsa topadi, bo'lmasa
      // yaratadi — shu bilan "mavjud tag qayta ishlatiladi" xatti-harakati
      // aynan shu funksiya darajasida simulyatsiya qilinadi.
      upsert: vi.fn(async ({ where }: { where: { name: string } }) => {
        const existing = tagsByName.get(where.name);
        if (existing) return existing;

        tagIdSeq += 1;
        const created = { id: `tag-${tagIdSeq}`, name: where.name };
        tagsByName.set(where.name, created);
        tagNameById.set(created.id, created.name);
        return created;
      }),
    },
    postTag: {
      createMany: vi.fn(
        async ({ data }: { data: { postId: string; tagId: string }[] }) => {
          for (const { postId, tagId } of data) {
            const names = tagNamesByPostId.get(postId) ?? [];
            const name = tagNameById.get(tagId);
            if (name && !names.includes(name)) names.push(name);
            tagNamesByPostId.set(postId, names);
          }
          return { count: data.length };
        },
      ),
    },
  };
}

const AUTHOR_ID = "user-1";

const baseImageDto: CreatePostInput = {
  title: "Test rasm posti",
  contentType: "IMAGE",
  fileId: "user-1/photo.jpg",
  visibility: "PUBLIC",
  isNsfw: false,
};

const baseCodeDto: CreatePostInput = {
  title: "Test kod posti",
  contentType: "CODE",
  codeContent: "console.log('salom');",
  visibility: "PUBLIC",
  isNsfw: false,
};

describe("posts.service.createPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postIdSeq = 0;
    tagIdSeq = 0;
    postsById = new Map();
    tagsByName = new Map();
    tagNameById = new Map();
    tagNamesByPostId = new Map();

    // Har bir testda prisma.$transaction(callback) chaqirilganda, shu
    // testga tegishli YANGI fake tx bilan callback bajariladi — haqiqiy
    // Prisma'dagi kabi, $transaction argumentni to'g'ridan-to'g'ri
    // chaqiruvchi funksiyaga uzatadi.
    vi.mocked(prisma.$transaction).mockImplementation((callback: any) =>
      callback(createFakeTx()),
    );
  });

  describe("contentType bo'yicha status", () => {
    it("IMAGE post yaratilganda status='PROCESSING' bo'ladi", async () => {
      const result = await createPost(AUTHOR_ID, baseImageDto);

      expect(result.status).toBe("PROCESSING");
    });

    it("IMAGE post uchun fon ishlov navbatiga (enqueue) to'g'ri postId/mediaPath bilan qo'shiladi", async () => {
      const result = await createPost(AUTHOR_ID, baseImageDto);

      expect(enqueue).toHaveBeenCalledWith("image-processing", {
        postId: result.id,
        mediaPath: baseImageDto.fileId,
      });
    });

    it("CODE post yaratilganda status='PUBLISHED' bo'ladi", async () => {
      const result = await createPost(AUTHOR_ID, baseCodeDto);

      expect(result.status).toBe("PUBLISHED");
    });

    it("CODE post uchun fon ishlov navbatiga hech narsa qo'shilmaydi", async () => {
      await createPost(AUTHOR_ID, baseCodeDto);

      expect(enqueue).not.toHaveBeenCalled();
    });
  });

  describe("tag biriktirish", () => {
    it("yangi tag nomlari berilganda, ular avtomatik (upsert orqali) yaratiladi va postga bog'lanadi", async () => {
      const result = await createPost(AUTHOR_ID, {
        ...baseCodeDto,
        tags: ["JavaScript", " AI "], // normalizatsiya: lowercase + trim kutiladi
      });

      expect(tagsByName.size).toBe(2);
      expect(tagsByName.has("javascript")).toBe(true);
      expect(tagsByName.has("ai")).toBe(true);
      expect(result.tags.sort()).toEqual(["ai", "javascript"]);
    });

    it("mavjud tag qayta berilganda, yangi Tag qatori yaratilmaydi — bor tag qayta ishlatiladi", async () => {
      // 1-post: "design" tegini birinchi marta yaratadi
      const firstPost = await createPost(AUTHOR_ID, {
        ...baseCodeDto,
        title: "Birinchi post",
        tags: ["design"],
      });

      expect(tagsByName.size).toBe(1);
      const tagIdAfterFirst = tagsByName.get("design")?.id;

      // 2-post: xuddi shu "design" tegini qayta ishlatadi
      const secondPost = await createPost(AUTHOR_ID, {
        ...baseCodeDto,
        title: "Ikkinchi post",
        tags: ["design"],
      });

      // Yangi Tag qatori YARATILMAGAN — jami tag soni hali ham 1
      expect(tagsByName.size).toBe(1);
      expect(tagsByName.get("design")?.id).toBe(tagIdAfterFirst);

      // Ikkala post ham bir xil (mavjud) tegga bog'langan
      expect(firstPost.tags).toEqual(["design"]);
      expect(secondPost.tags).toEqual(["design"]);
      expect(firstPost.id).not.toBe(secondPost.id);
    });

    it("tags berilmasa, tag.upsert umuman chaqirilmaydi", async () => {
      const result = await createPost(AUTHOR_ID, baseCodeDto);

      expect(result.tags).toEqual([]);
      expect(tagsByName.size).toBe(0);
    });
  });
});
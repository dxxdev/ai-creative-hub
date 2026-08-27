import { Prisma } from "@prisma/client";
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from "@repo/shared";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { enqueueImageProcessingJob } from "../queues/image-processing.queue.js";
import { detectCodeLanguage } from "./code-language-detection.service.js";

export class PostNotFoundError extends AppError {
  constructor() {
    super("Post topilmadi", 404);
  }
}

export class PostForbiddenError extends AppError {
  constructor() {
    super("Bu postni o'zgartirish huquqingiz yo'q", 403);
  }
}

// Post bilan birga tag nomlarini ham qaytaradigan umumiy `select`
const postWithTagsSelect = {
  id: true,
  authorId: true,
  title: true,
  description: true,
  contentType: true,
  visibility: true,
  status: true,
  mediaPath: true,
  thumbnailPath: true,
  width: true,
  height: true,
  codeContent: true,
  codeLanguage: true,
  viewCount: true,
  likeCount: true,
  remixCount: true,
  isNsfw: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.PostSelect;

function mapPost<T extends { tags: { tag: { name: string } }[] }>(post: T) {
  const { tags, ...rest } = post;
  return { ...rest, tags: tags.map((t) => t.tag.name) };
}

/**
 * Berilgan `postId`ga `tagNames` ro'yxatidagi teglarni bog'laydi.
 *
 * Har bir tag nomi lowercase + trim orqali normalizatsiya qilinadi
 * (masalan " AI " va "ai" bir xil tag sifatida ko'riladi), so'ng
 * Tag jadvalida upsert qilinadi (mavjud bo'lsa topiladi, bo'lmasa
 * yangi yaratiladi). Nihoyat, Post <-> Tag bog'lanishlari PostTag
 * jadvaliga bitta createMany chaqiruvi orqali (N marta alohida
 * create() o'rniga) qo'shiladi — skipDuplicates: true bilan, shunda
 * allaqachon mavjud bog'lanish qayta urinilganda xato tashlamaydi.
 *
 * `tx` — global `prisma` klient EMAS, balki $transaction() orqali
 * ochilgan tranzaksiya klienti. Shu orqali Post yaratish va teglarni
 * bog'lash bitta atomik operatsiyaga birlashadi: agar ikkalasidan
 * biri xato bersa, ikkalasi ham (Post yozuvi ham) saqlanmaydi.
 */
async function attachTags(
  tx: Prisma.TransactionClient,
  postId: string,
  tagNames: string[],
): Promise<void> {
  const normalizedNames = Array.from(
    new Set(
      tagNames
        .map((name) => name.trim().toLowerCase())
        .filter((name) => name.length > 0),
    ),
  );

  if (normalizedNames.length === 0) return;

  const tags = await Promise.all(
    normalizedNames.map((name) =>
      tx.tag.upsert({
        where: { name },
        create: { name },
        update: {}, // tag allaqachon mavjud bo'lsa, hech narsa o'zgartirilmaydi
      }),
    ),
  );

  await tx.postTag.createMany({
    data: tags.map((tag) => ({ postId, tagId: tag.id })),
    skipDuplicates: true,
  });
}

export async function createPost(userId: string, dto: CreatePostInput) {
  const { tags, fileId, codeContent, codeLanguage, ...baseFields } = dto;
  // baseFields = { title, description, contentType, visibility, isNsfw } —
  // bularning barchasi Post modelidagi ustunlar bilan bevosita mos keladi.

  if (dto.contentType === "IMAGE") {
    if (!fileId) {
      // CreatePostSchema.superRefine bu holatni allaqachon rad etadi,
      // lekin ikkinchi qatlam himoya sifatida bu yerda ham tekshiramiz.
      throw new AppError("IMAGE turidagi post uchun fileId majburiy", 400);
    }

    // fileId — POST /media/upload'dan (2-kun) qaytgan qiymatning aynan
    // o'zi: diskdagi nisbiy fayl yo'li (local-storage.service.ts'dagi
    // toRelativeStoragePath natijasi, masalan "{userId}/{uuid}.jpg").
    // V1'da qo'shimcha ko'chirish/tasdiqlash qadami yo'q — shu nisbiy
    // yo'l to'g'ridan-to'g'ri Post.mediaPath sifatida saqlanadi.
    const mediaPath = fileId;

    // Post yaratish va teglarni bog'lash bitta atomik operatsiya:
    // agar tag bog'lash bosqichida xato chiqsa, Post yozuvining o'zi
    // ham saqlanmay qoladi (tranzaksiya to'liq rollback qilinadi).
    const finalPost = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const post = await tx.post.create({
        data: {
          ...baseFields,
          authorId: userId,
          mediaPath,
          // Thumbnail hali tayyor emas — worker (4-kun) uni generatsiya
          // qilib, statusni PUBLISHED'ga o'tkazgunga qadar PROCESSING'da qoladi.
          status: "PROCESSING",
        },
        select: postWithTagsSelect,
      });

      if (!tags?.length) return post;

      await attachTags(tx, post.id, tags);
      return tx.post.findUniqueOrThrow({ where: { id: post.id }, select: postWithTagsSelect });
    });

    // MUHIM: navbatga faqat tranzaksiya MUVAFFAQIYATLI commit bo'lgandan
    // keyin qo'shamiz — aks holda tranzaksiya rollback qilingan taqdirda
    // (masalan tag bog'lashda xato chiqsa), mavjud bo'lmagan Post uchun
    // fon ishi (worker) ishga tushib qolishi mumkin edi.
    enqueueImageProcessingJob({ postId: finalPost.id, mediaPath });

    return mapPost(finalPost);
  }

  // CODE (va V1 doirasidan tashqari boshqa content turlari uchun
  // kelajakdagi kengaytmalar) — fon ishlovi shart emas, shuning uchun
  // sinxron ravishda to'g'ridan-to'g'ri PUBLISHED holatida yaratiladi.
  if (!codeContent) {
    // CreatePostSchema.superRefine bu holatni allaqachon rad etadi,
    // lekin ikkinchi qatlam himoya sifatida bu yerda ham tekshiramiz.
    throw new AppError("CODE turidagi post uchun codeContent majburiy", 400);
  }

  // Til aniqlash (5-kun): hozircha stub — foydalanuvchi ko'rsatgan
  // codeLanguage ustunlik qiladi, aniqlash natijasi faqat u
  // ko'rsatilmagan holatda zaxira (fallback) sifatida ishlatiladi.
  const detectedLanguage = await detectCodeLanguage(codeContent);
  const resolvedLanguage = codeLanguage ?? detectedLanguage ?? undefined;

  // Post yaratish va teglarni bog'lash bitta atomik operatsiya (IMAGE
  // shoxidagi bilan bir xil sabab: xato bo'lsa hech narsa saqlanmasin).
  const finalPost = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const post = await tx.post.create({
      data: {
        ...baseFields,
        authorId: userId,
        codeContent,
        codeLanguage: resolvedLanguage,
        // mediaPath ataylab qo'yilmaydi — Prisma uni null qoldiradi,
        // chunki CODE post'da diskdagi media fayl mavjud emas.
        status: "PUBLISHED",
      },
      select: postWithTagsSelect,
    });

    if (!tags?.length) return post;

    await attachTags(tx, post.id, tags);
    return tx.post.findUniqueOrThrow({ where: { id: post.id }, select: postWithTagsSelect });
  });

  return mapPost(finalPost);
}

export async function getPostById(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: postWithTagsSelect,
  });

  return post ? mapPost(post) : null;
}

export async function incrementViewCount(id: string) {
  await prisma.post.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
  });
}

export async function listPosts(query: ListPostsQuery) {
  const { cursor, limit, contentType, authorId, tag } = query;

  const where: Prisma.PostWhereInput = {
    visibility: "PUBLIC",
    status: "PUBLISHED",
    ...(contentType ? { contentType } : {}),
    ...(authorId ? { authorId } : {}),
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
  };

  const posts = await prisma.post.findMany({
    where,
    select: postWithTagsSelect,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit).map(mapPost);
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return { items, nextCursor };
}

export async function updatePost(id: string, authorId: string, input: UpdatePostInput) {
  const existing = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!existing) throw new PostNotFoundError();
  if (existing.authorId !== authorId) throw new PostForbiddenError();

  const { tags, ...data } = input;

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...data,
      ...(tags
        ? {
            tags: {
              deleteMany: {},
              create: tags.map((name) => ({
                tag: { connectOrCreate: { where: { name }, create: { name } } },
              })),
            },
          }
        : {}),
    },
    select: postWithTagsSelect,
  });

  return mapPost(post);
}

export async function deletePost(id: string, authorId: string) {
  const existing = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!existing) throw new PostNotFoundError();
  if (existing.authorId !== authorId) throw new PostForbiddenError();

  await prisma.post.delete({ where: { id } });
}
import { Prisma } from "@prisma/client";
import type {
  CreatePostInput,
  ListPostsQuery,
  PostDetail,
  PostFeedItem,
  UpdatePostInput,
} from "@repo/shared";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { enqueue } from "../queues/job-queue.js";
import { IMAGE_PROCESSING_JOB_TYPE } from "../queues/image-processing.worker.js";
import { detectLanguage, highlightCode } from "./language-detection.service.js";
import { toPublicUploadUrl } from "./local-storage.service.js";

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
  codeHighlightHtml: true,
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
 * GET /posts/:id (bitta postni to'liq ko'rish) uchun `select` — muallif
 * (id, username) va teglar bilan birga, `PostDetail`ni to'ldirish uchun
 * kerakli barcha ustunlar. `authorId` va `visibility` DTO'ning o'zida
 * ko'rinmasa ham (`PostDetail` tipida yo'q), `findById()` ichida
 * PRIVATE-postga ruxsat tekshiruvi uchun kerak, shuning uchun select'ga
 * kiritilgan.
 */
const postDetailSelect = {
  id: true,
  authorId: true,
  title: true,
  description: true,
  contentType: true,
  visibility: true,
  mediaPath: true,
  thumbnailPath: true,
  width: true,
  height: true,
  codeContent: true,
  codeLanguage: true,
  codeHighlightHtml: true,
  likeCount: true,
  remixCount: true,
  createdAt: true,
  author: { select: { id: true, username: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.PostSelect;

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
    enqueue(IMAGE_PROCESSING_JOB_TYPE, { postId: finalPost.id, mediaPath });

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

  // Til aniqlash: foydalanuvchi qo'lda tanlagan bo'lsa (`codeLanguage`),
  // u ustunlik qiladi; aks holda highlight.js orqali kod matnidan
  // avtomatik aniqlanadi. Ikkala holatda ham detectLanguage() har doim
  // haqiqiy til nomi qaytaradi (hech qachon null/undefined emas —
  // aniqlab bo'lmasa "plaintext"), shuning uchun keyingi qadamlarda
  // qo'shimcha fallback shart emas.
  const resolvedLanguage = detectLanguage(codeContent, codeLanguage);

  // Syntax-highlight HTML'ni FAQAT shu yerda, post birinchi marta
  // yaratilayotganda bir marta hisoblaymiz va natijani
  // Post.codeHighlightHtml ustuniga saqlaymiz — kod o'zgarmas
  // bo'lgani uchun keyingi barcha o'qishlarda bu tayyor HTML
  // to'g'ridan-to'g'ri bazadan qaytariladi, qayta hisoblash shart
  // bo'lmaydi (batafsili: language-detection.service.ts'dagi
  // highlightCode() izohiga qarang).
  const codeHighlightHtml = highlightCode(codeContent, resolvedLanguage);

  // Post yaratish va teglarni bog'lash bitta atomik operatsiya (IMAGE
  // shoxidagi bilan bir xil sabab: xato bo'lsa hech narsa saqlanmasin).
  const finalPost = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const post = await tx.post.create({
      data: {
        ...baseFields,
        authorId: userId,
        codeContent,
        codeLanguage: resolvedLanguage,
        codeHighlightHtml,
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

/**
 * Bitta postni to'liq (muallif, teglar, CODE bo'lsa tayyor
 * `codeHighlightHtml`, va — foydalanuvchi tizimga kirgan bo'lsa —
 * `viewerHasLiked` bilan) qaytaradi.
 *
 * @param id - qidirilayotgan post ID'si.
 * @param viewerId - joriy so'rovni yuborayotgan foydalanuvchi ID'si,
 *   yoki `null` (anonim/tizimga kirmagan). `optionalAuthGuard`
 *   orqali `req.user`dan olinadi — token yo'q/yaroqsiz bo'lsa ham
 *   xato tashlanmaydi, shunchaki `null` sifatida davom etiladi.
 * @returns `PostDetail`, yoki quyidagi ikkala holatda ham `null`:
 *   (1) bunday ID'li post umuman mavjud emas, (2) post `PRIVATE` va
 *   `viewerId` uning muallifi emas. Ikkala holat ATAYLAB bir xil
 *   natija (`null`) bilan ifodalanadi — chaqiruvchi (controller) buni
 *   404'ga aylantiradi, shunda tashqi foydalanuvchi "bu ID band, lekin
 *   private" va "bunday post umuman yo'q" o'rtasidagi farqni bila
 *   olmaydi (privatlikni oshkor qilmaslik uchun standart amaliyot).
 */
export async function findById(id: string, viewerId: string | null): Promise<PostDetail | null> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: postDetailSelect,
  });

  if (!post) return null;

  if (post.visibility === "PRIVATE" && post.authorId !== viewerId) {
    return null;
  }

  // Like tekshiruvi faqat foydalanuvchi tizimga kirgan bo'lsagina
  // bajariladi — anonim so'rov uchun bazaga ortiqcha murojaat qilib
  // o'tirmasdan, darhol `false` qaytariladi.
  const viewerHasLiked = viewerId
    ? (await prisma.like.findUnique({
        where: { postId_userId: { postId: id, userId: viewerId } },
        select: { userId: true },
      })) !== null
    : false;

  return {
    id: post.id,
    title: post.title,
    description: post.description,
    thumbnailUrl: post.thumbnailPath ? toPublicUploadUrl(post.thumbnailPath) : null,
    mediaUrl: post.mediaPath ? toPublicUploadUrl(post.mediaPath) : null,
    contentType: post.contentType,
    author: {
      id: post.author.id,
      username: post.author.username,
      // User modelida hozircha avatarUrl ustuni yo'q (avatar yuklash
      // funksiyasi V1 doirasidan tashqarida) — shu ustun qo'shilgach,
      // shu yerni ham yangilang.
      avatarUrl: null,
    },
    // codeHighlightHtml — allaqachon post yaratilganda BIR MARTA
    // hisoblab, Post.codeHighlightHtml ustuniga saqlab qo'yilgan
    // (posts.service.ts'dagi createPost'ga qarang). Bu yerda faqat
    // bazadan o'qib, o'zgarishsiz qaytariladi — qayta hisoblanmaydi.
    // IMAGE postlar uchun bu maydon DB'da tabiiy ravishda `null`
    // bo'lgani sababli, "faqat CODE bo'lsa qo'sh" shartini alohida
    // yozishning hojati yo'q — natija baribir bir xil.
    codeContent: post.codeContent,
    codeLanguage: post.codeLanguage,
    codeHighlightHtml: post.codeHighlightHtml,
    width: post.width,
    height: post.height,
    likeCount: post.likeCount,
    remixCount: post.remixCount,
    tags: post.tags.map((t: { tag: { name: string } }) => t.tag.name),
    createdAt: post.createdAt.toISOString(),
    viewerHasLiked,
  };
}

/**
 * GET /posts (ommaviy feed) uchun YENGIL Prisma `select` — faqat feed
 * kartochkasi uchun kerakli maydonlar. `postWithTagsSelect`dan ATAYLAB
 * alohida: og'ir `@db.Text` ustunlar (codeContent, codeHighlightHtml)
 * bu yerga umuman kiritilmagan — bitta sahifada 24–50 ta post bo'lishi
 * mumkin, ularning har birining to'liq kod matni/HTML'ini olib kelish
 * behuda trafik va DB yuki bo'lardi (bular faqat GET /posts/:id orqali,
 * bitta postni ochganda kerak bo'ladi).
 */
const postSummarySelect = {
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
  codeLanguage: true,
  viewCount: true,
  likeCount: true,
  remixCount: true,
  isNsfw: true,
  createdAt: true,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.PostSelect;

/**
 * Xom Prisma qatorini (`postSummarySelect` shakli) ommaga ochiq
 * `PostFeedItem` DTO'siga aylantiradi: teglar tekis massivga tushiriladi,
 * `mediaPath`/`thumbnailPath` (diskka nisbiy xom yo'llar) esa
 * `toPublicUploadUrl()` orqali to'liq, ishlatishga tayyor URL'larga
 * (`mediaUrl`/`thumbnailUrl`) aylantiriladi.
 *
 * Generic constraint (yuqoridagi `mapPost()`dagi kabi) ataylab
 * `Prisma.PostGetPayload<{ select: typeof postSummarySelect }>` o'rniga
 * ishlatilgan — bu tip `PostFeedItem`ning o'zidan (bitta manba) hosil
 * qilinadi, shuning uchun Prisma generatsiya qilingan tiplariga
 * to'g'ridan-to'g'ri bog'liq emas va kelajakda `postSummarySelect`
 * o'zgarsa ham izchil qolaveradi.
 */
function mapToPostFeedItem<
  T extends Omit<PostFeedItem, "tags" | "mediaUrl" | "thumbnailUrl"> & {
    mediaPath: string | null;
    thumbnailPath: string | null;
    tags: { tag: { name: string } }[];
  },
>(post: T): PostFeedItem {
  const { tags, mediaPath, thumbnailPath, ...rest } = post;

  return {
    ...rest,
    tags: tags.map((t) => t.tag.name),
    mediaUrl: mediaPath ? toPublicUploadUrl(mediaPath) : null,
    thumbnailUrl: thumbnailPath ? toPublicUploadUrl(thumbnailPath) : null,
  };
}

/**
 * Ommaviy feed (GET /posts): cursor-based (keyset) sahifalash bilan.
 *
 * Faqat `visibility: "PUBLIC"` va `status: "PUBLISHED"` postlar
 * qaytariladi — PROCESSING (hali worker tugatmagan), FAILED, PRIVATE
 * va UNLISTED postlar bu yerda hech qachon ko'rinmaydi (buni bittalab
 * ko'rish uchun alohida `findById` + ruxsat tekshiruvi bor).
 *
 * SAHIFALASH: `take: limit + 1` bilan so'raladi — agar qaytgan qatorlar
 * soni `limit`dan ko'p bo'lsa (ya'ni "qo'shimcha" (limit+1)-elementning
 * o'zi mavjud bo'lsa), demak yana keyingi sahifa bor. O'sha qo'shimcha
 * element javobga QO'SHILMAYDI (`slice(0, limit)`), faqat "yana bor"
 * belgisi sifatida ishlatiladi va `nextCursor` shu sahifadagi oxirgi
 * elementning id'siga o'rnatiladi. Klassik `page`/`offset` o'rniga
 * `cursor: { id: cursor }, skip: 1` ishlatilishining sababi — offset
 * usuli katta jadvallarda sekinlashadi (DB har safar boshidan N ta
 * qatorni sanab o'tishi kerak) va yangi postlar doim qo'shilib
 * turadigan feed'da sahifalar orasida takrorlanish/o'tkazib yuborish
 * xatolariga olib kelishi mumkin; cursor esa "shu ID'dan keyingisi"
 * tarzida ishlagani uchun bunday muammolardan xoli.
 *
 * `totalCount` — filtrlarga mos KELUVCHI BARCHA (faqat shu sahifadagi
 * emas) postlar soni, `prisma.post.count()` orqali `findMany` bilan
 * bir vaqtda (`Promise.all`) olinadi.
 */
export async function findMany(
  query: ListPostsQuery,
): Promise<{ items: PostFeedItem[]; nextCursor: string | null; totalCount: number }> {
  const { cursor, limit, contentType, authorId, tag, sortBy } = query;

  const where: Prisma.PostWhereInput = {
    visibility: "PUBLIC",
    status: "PUBLISHED",
    ...(contentType ? { contentType } : {}),
    ...(authorId ? { authorId } : {}),
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
  };

  // "popular" tartiblash — HOZIRCHA oddiy variant: avval `likeCount`
  // bo'yicha (asosiy "mashhurlik" signali), keyin `createdAt` bo'yicha
  // (bir xil like'ga ega postlar orasida yangisi tepada chiqadi).
  //
  // Nega faqat likeCount (remixCount emas)? Prisma'ning `orderBy`si
  // ustunlar ustida arifmetik amal (masalan `likeCount * 2 + remixCount`)
  // bajarishni QO'LLAB-QUVVATLAMAYDI — buni faqat xom SQL (`$queryRaw`)
  // yoki oldindan hisoblab qo'yilgan (materialized) alohida ustun orqali
  // qilish mumkin. Shuning uchun V1'da faqat bitta signalga (likeCount)
  // tayanamiz — bu "trending" emas, oddiy "eng ko'p like olgan"
  // tartiblash, xolos.
  //
  // KELAJAKDA: haqiqiy "trending"/mashhurlik formulasi ancha
  // murakkablashishi mumkin — masalan `remixCount`ni ham hisobga olish,
  // vaqt bo'yicha "so'nish" (time decay — eski post abadiy tepada
  // qolib ketmasligi uchun, Hacker News/Reddit "hot" formulasiga
  // o'xshash), yoki ko'rishlar tezligi (view velocity) kabi mezonlar
  // qo'shilishi mumkin. Bunday formula endi Prisma'ning oddiy `orderBy`
  // massivi bilan ifodalanmaydi — yoki xom SQL so'rovi, yoki fon
  // ishi (job) orqali davriy ravishda qayta hisoblanib, alohida
  // `popularityScore` ustuniga saqlanadigan (keyin oddiy `orderBy:
  // { popularityScore: "desc" }` bilan saralanadigan) yechimga o'tish
  // kerak bo'ladi.
  //
  // Oxirgi `id: "desc"` mezoni — bularning ikkalasiga ham tegishli emas,
  // sof texnik sabab: agar bir nechta post bir xil `likeCount`/`createdAt`
  // qiymatiga ega bo'lsa (masalan millisekund darajasida bir vaqtda
  // yaratilgan bo'lsa), tartiblash har so'rovda bir xil bo'lishini
  // kafolatlaydi — aks holda cursor'li sahifalash chegara holatlarida
  // (tenglik) post takrorlanishi yoki o'tkazib yuborilishi mumkin edi.
  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    sortBy === "popular"
      ? [{ likeCount: "desc" }, { createdAt: "desc" }, { id: "desc" }]
      : [{ createdAt: "desc" }, { id: "desc" }];

  const [rows, totalCount] = await Promise.all([
    prisma.post.findMany({
      where,
      select: postSummarySelect,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.post.count({ where }),
  ]);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(mapToPostFeedItem);
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor, totalCount };
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
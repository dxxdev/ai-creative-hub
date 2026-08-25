import { z } from "zod";

// ---------------------------------------------------------------------------
// ENUMLAR — Prisma schema.prisma bilan bir xil qiymatlar
// ---------------------------------------------------------------------------

export const ContentTypeSchema = z.enum([
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "CODE",
  "MODEL_3D",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

// V1/MVP doirasida faqat shu ikkitasi qo'llab-quvvatlanadi
export const SupportedContentTypeSchema = z.enum(["IMAGE", "CODE"]);
export type SupportedContentType = z.infer<typeof SupportedContentTypeSchema>;

export const PostVisibilitySchema = z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]);
export type PostVisibility = z.infer<typeof PostVisibilitySchema>;

export const PostStatusSchema = z.enum(["PROCESSING", "PUBLISHED", "FAILED"]);
export type PostStatus = z.infer<typeof PostStatusSchema>;

// ---------------------------------------------------------------------------
// CREATE POST — contentType bo'yicha discriminated union
// IMAGE uchun mediaPath majburiy, CODE uchun codeContent majburiy
// ---------------------------------------------------------------------------

const basePostFields = {
  title: z.string().min(1, "Sarlavha majburiy").max(200),
  description: z.string().max(2000).optional(),
  visibility: PostVisibilitySchema.default("PUBLIC"),
  isNsfw: z.boolean().default(false),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
};

export const CreateImagePostSchema = z.object({
  ...basePostFields,
  contentType: z.literal("IMAGE"),
  mediaPath: z.string().min(1, "mediaPath majburiy"),
  thumbnailPath: z.string().min(1).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const CreateCodePostSchema = z.object({
  ...basePostFields,
  contentType: z.literal("CODE"),
  codeContent: z.string().min(1, "Kod matni bo'sh bo'lmasligi kerak"),
  codeLanguage: z.string().min(1).max(50),
});

export const CreatePostSchema = z
  .object({
    title: z
      .string()
      .min(3, "Sarlavha kamida 3 belgi bo'lishi kerak")
      .max(100, "Sarlavha 100 belgidan oshmasligi kerak"),
    description: z
      .string()
      .max(500, "Tavsif 500 belgidan oshmasligi kerak")
      .optional(),
    contentType: z.enum(["IMAGE", "CODE"]),
    visibility: z
      .enum(["PUBLIC", "UNLISTED", "PRIVATE"])
      .optional()
      .default("PUBLIC"),
    tags: z
      .array(z.string().max(30, "Har bir tag 30 belgidan oshmasligi kerak"))
      .max(10, "Ko'pi bilan 10 ta tag qo'shish mumkin")
      .optional(),
    isNsfw: z.boolean().optional().default(false),

    // IMAGE uchun — R2'ga presigned URL orqali yuklangan faylning kaliti
    fileKey: z.string().optional(),

    // CODE uchun
    codeContent: z.string().optional(),
    codeLanguage: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.contentType === "CODE" && !data.codeContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CODE turidagi post uchun codeContent majburiy",
        path: ["codeContent"],
      });
    }

    if (data.contentType === "IMAGE" && !data.fileKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "IMAGE turidagi post uchun fileKey majburiy",
        path: ["fileKey"],
      });
    }
  });

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

// ---------------------------------------------------------------------------
// UPDATE POST — barcha maydonlar optional (contentType o'zgartirilmaydi)
// ---------------------------------------------------------------------------

export const UpdatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  visibility: PostVisibilitySchema.optional(),
  isNsfw: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
});
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;

// ---------------------------------------------------------------------------
// LIST QUERY — pagination va filterlash uchun
// ---------------------------------------------------------------------------

export const ListPostsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  contentType: SupportedContentTypeSchema.optional(),
  authorId: z.string().uuid().optional(),
  tag: z.string().optional(),
});
export type ListPostsQuery = z.infer<typeof ListPostsQuerySchema>;

// ---------------------------------------------------------------------------
// RESPONSE — API javobi (client uchun umumiy tip)
// ---------------------------------------------------------------------------

export const PostResponseSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  contentType: ContentTypeSchema,
  visibility: PostVisibilitySchema,
  status: PostStatusSchema,
  mediaPath: z.string().nullable(),
  thumbnailPath: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  codeContent: z.string().nullable(),
  codeLanguage: z.string().nullable(),
  viewCount: z.number(),
  likeCount: z.number(),
  remixCount: z.number(),
  isNsfw: z.boolean(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PostResponse = z.infer<typeof PostResponseSchema>;
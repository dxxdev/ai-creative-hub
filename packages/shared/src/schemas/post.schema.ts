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
// IMAGE uchun mediaUrl majburiy, CODE uchun codeContent majburiy
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
  mediaUrl: z.string().url("mediaUrl noto'g'ri URL"),
  thumbnailUrl: z.string().url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const CreateCodePostSchema = z.object({
  ...basePostFields,
  contentType: z.literal("CODE"),
  codeContent: z.string().min(1, "Kod matni bo'sh bo'lmasligi kerak"),
  codeLanguage: z.string().min(1).max(50),
});

export const CreatePostSchema = z.discriminatedUnion("contentType", [
  CreateImagePostSchema,
  CreateCodePostSchema,
]);
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
  mediaUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
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
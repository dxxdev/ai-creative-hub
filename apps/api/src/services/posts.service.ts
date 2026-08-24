import { Prisma } from "@prisma/client";
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from "@repo/shared";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";

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
  mediaUrl: true,
  thumbnailUrl: true,
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

export async function createPost(authorId: string, input: CreatePostInput) {
  const { tags, ...data } = input;

  const post = await prisma.post.create({
    data: {
      ...data,
      authorId,
      status: "PUBLISHED", // V1: sinxron yuklash, keyinchalik BullMQ orqali PROCESSING bo'lishi mumkin
      tags: tags?.length
        ? {
            create: tags.map((name) => ({
              tag: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            })),
          }
        : undefined,
    },
    select: postWithTagsSelect,
  });

  return mapPost(post);
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
import type { Request, Response, NextFunction } from "express";
import type { CreatePostInput, UpdatePostInput } from "@repo/shared";
import { ListPostsQuerySchema } from "@repo/shared";
import * as postsService from "../services/posts.service.js";

// POST /api/posts — validateSchema(CreatePostSchema) route'da bajariladi
export async function createPost(req: Request, res: Response, next: NextFunction) {
  try {
    const authorId = req.user!.userId;
    const post = await postsService.createPost(authorId, req.body as CreatePostInput);

    return res.status(201).json({ success: true, data: post });
  } catch (error) {
    next(error);
    return;
  }
}

// GET /api/posts/:id — optionalAuthGuard orqali req.user bo'lishi ham, bo'lmasligi ham mumkin
export async function getPost(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const post = await postsService.getPostById(id);

    if (!post) {
      return res.status(404).json({ success: false, error: "Post topilmadi" });
    }

    // Private postlarni faqat muallif ko'ra oladi
    if (post.visibility === "PRIVATE" && post.authorId !== req.user?.userId) {
      return res.status(404).json({ success: false, error: "Post topilmadi" });
    }

    postsService.incrementViewCount(id).catch(() => void 0); // fire-and-forget

    return res.status(200).json({ success: true, data: post });
  } catch (error) {
    next(error);
    return;
  }
}

// GET /api/posts — validateSchema faqat req.body'ni tekshiradi, shuning uchun
// query-string bu yerda alohida safeParse qilinadi (limit uchun coerce.number() kerak)
export async function listPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ListPostsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Yuborilgan ma'lumotlar noto'g'ri",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await postsService.listPosts(parsed.data);

    return res.status(200).json({
      success: true,
      data: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
    return;
  }
}

// PATCH /api/posts/:id — validateSchema(UpdatePostSchema) route'da bajariladi
export async function updatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const authorId = req.user!.userId;
    const post = await postsService.updatePost(id, authorId, req.body as UpdatePostInput);

    return res.status(200).json({ success: true, data: post });
  } catch (error) {
    next(error);
    return;
  }
}

// DELETE /api/posts/:id
export async function deletePost(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const authorId = req.user!.userId;
    await postsService.deletePost(id, authorId);

    return res.status(204).send();
  } catch (error) {
    next(error);
    return;
  }
}
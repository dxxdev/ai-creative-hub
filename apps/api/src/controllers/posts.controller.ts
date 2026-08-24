import type { Request, Response, NextFunction } from "express";
import {
  CreatePostSchema,
  UpdatePostSchema,
  ListPostsQuerySchema,
} from "@repo/shared";
import * as postsService from "../services/posts.service.js";

// POST /api/posts
export async function createPost(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = CreatePostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const authorId = req.user!.id; // auth middleware orqali to'ldiriladi
    const post = await postsService.createPost(authorId, parsed.data);

    return res.status(201).json({ data: post });
  } catch (err) {
    next(err);
  }
}

// GET /api/posts/:id
export async function getPost(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const post = await postsService.getPostById(id);

    if (!post) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Private postlarni faqat muallif ko'ra oladi
    if (post.visibility === "PRIVATE" && post.authorId !== req.user?.id) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    postsService.incrementViewCount(id).catch(() => void 0); // fire-and-forget

    return res.status(200).json({ data: post });
  } catch (err) {
    next(err);
  }
}

// GET /api/posts
export async function listPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ListPostsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const result = await postsService.listPosts(parsed.data);
    return res.status(200).json({ data: result.items, nextCursor: result.nextCursor });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/posts/:id
export async function updatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = UpdatePostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    }

    const { id } = req.params;
    const authorId = req.user!.id;
    const result = await postsService.updatePost(id, authorId, parsed.data);

    if (result.error === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
    if (result.error === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });

    return res.status(200).json({ data: result.data });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/posts/:id
export async function deletePost(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const authorId = req.user!.id;
    const result = await postsService.deletePost(id, authorId);

    if (result.error === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
    if (result.error === "FORBIDDEN") return res.status(403).json({ error: "FORBIDDEN" });

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}
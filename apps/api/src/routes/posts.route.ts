import { Router } from "express";
import { CreatePostSchema, UpdatePostSchema } from "@repo/shared";
import { validateSchema } from "../middlewares/validateSchema.js";
import { authGuard } from "../middlewares/authGuard.js";
import { optionalAuthGuard } from "../middlewares/optionalAuthGuard.js";
import {
  createPost,
  getPost,
  listPosts,
  updatePost,
  deletePost,
} from "../controllers/posts.controller.js";

const router = Router();

// Public/optional-auth endpointlar (PRIVATE post tekshiruvi uchun optionalAuthGuard kerak)
router.get("/", optionalAuthGuard, listPosts);
router.get("/:id", optionalAuthGuard, getPost);

// Auth talab qilinadigan endpointlar
router.post("/", authGuard, validateSchema(CreatePostSchema), createPost);
router.patch("/:id", authGuard, validateSchema(UpdatePostSchema), updatePost);
router.delete("/:id", authGuard, deletePost);

export default router;
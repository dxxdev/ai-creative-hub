import { Router } from "express";
import { CreatePostSchema, UpdatePostSchema } from "@repo/shared";
import { authGuard } from "../middlewares/authGuard.js";
import { optionalAuthGuard } from "../middlewares/optionalAuthGuard.js";
import {
  createPostHandler,
  getPost,
  listPostsHandler,
  updatePost,
  deletePost,
} from "../controllers/posts.controller.js";
import { postsErrorHandler, validatePostsSchema } from "src/middlewares/posts-response.middleware.js";

const router = Router();

// Public/optional-auth endpointlar (PRIVATE post tekshiruvi uchun optionalAuthGuard kerak)
router.get("/", optionalAuthGuard, listPostsHandler);
router.get("/:id", optionalAuthGuard, getPost);

// Auth talab qilinadigan endpointlar
router.post("/", authGuard, validatePostsSchema(CreatePostSchema), createPostHandler);
router.patch("/:id", authGuard, validatePostsSchema(UpdatePostSchema), updatePost);
router.delete("/:id", authGuard, deletePost);

router.use(postsErrorHandler)

export default router;
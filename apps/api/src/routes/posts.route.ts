import { Router } from "express";
import * as postsController from "../controllers/posts.controller.js";
import { requireAuth } from "../middlewares/require-auth.js";
import { optionalAuth } from "../middlewares/optional-auth.js";

const router = Router();

// Public/optional-auth endpointlar (PRIVATE post tekshiruvi uchun optionalAuth kerak)
router.get("/", optionalAuth, postsController.listPosts);
router.get("/:id", optionalAuth, postsController.getPost);

// Auth talab qilinadigan endpointlar
router.post("/", requireAuth, postsController.createPost);
router.patch("/:id", requireAuth, postsController.updatePost);
router.delete("/:id", requireAuth, postsController.deletePost);

export default router;
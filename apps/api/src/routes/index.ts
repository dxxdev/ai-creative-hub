import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import userRoutes from "../modules/auth/user.routes.js";
import postsRoutes from "./posts.route.js";

import { resendVerificationController } from '../modules/auth/resendVerification.controller.js';


const router = Router();

router.use(healthRoutes);
router.use("/api/auth", authRoutes);
router.post('/api/auth/resend-verification', resendVerificationController);
router.use("/api/users", userRoutes)
router.use("/api/posts", postsRoutes);

export default router;
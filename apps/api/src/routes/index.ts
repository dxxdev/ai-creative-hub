import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";

import { resendVerificationController } from '../modules/auth/resendVerification.controller.js';


const router = Router();

router.use(healthRoutes);
router.use("/api/auth", authRoutes);
router.post('/api/auth/resend-verification', resendVerificationController);

export default router;
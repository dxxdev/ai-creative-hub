import { Router } from "express";
import healthRoutes from "./health.routes.js";

const router = Router();

router.use(healthRoutes);

// TODO: keyingi route'lar shu yerga qo'shiladi
// Masalan: router.use("/api/auth", authRoutes);

export default router;
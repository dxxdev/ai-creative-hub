import { Router } from "express";
import { RegisterSchema, VerifyEmailSchema } from "@repo/shared";
import { validateSchema } from "../middlewares/validateSchema.js";
import { registerHandler, verifyEmailHandler } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", validateSchema(RegisterSchema), registerHandler);
router.post("/verify-email", validateSchema(VerifyEmailSchema), verifyEmailHandler);

export default router;
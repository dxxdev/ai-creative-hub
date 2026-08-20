import { Router } from "express";
import { RegisterSchema, VerifyEmailSchema } from "@repo/shared";
import { validateSchema } from "../middlewares/validateSchema.js";
import { registerHandler, verifyEmailHandler } from "../controllers/auth.controller.js";
import { verifyOtpController } from "src/modules/auth/verifyOtp.controller.js";
import { resendVerificationController } from "src/modules/auth/resendVerification.controller.js";

const router = Router();

router.post("/register", validateSchema(RegisterSchema), registerHandler);
router.post("/verify-email", validateSchema(VerifyEmailSchema), verifyEmailHandler);
router.post("/verify-otp", verifyOtpController);
router.post("/resend-verification", resendVerificationController)

export default router;
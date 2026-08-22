import { Router } from "express";
import { forgotPasswordSchema, loginSchema, RegisterSchema, VerifyEmailSchema } from "@repo/shared";
import { validateSchema } from "../middlewares/validateSchema.js";
import { registerHandler, verifyEmailHandler } from "../controllers/auth.controller.js";
import { verifyOtpController } from "src/modules/auth/verifyOtp.controller.js";
import { resendVerificationController } from "src/modules/auth/resendVerification.controller.js";
import { loginController } from "src/modules/auth/login.controller.js";
import { refreshController } from "src/modules/auth/refresh.controller.js";
import { logoutController } from "src/modules/auth/logout.controller.js";
import { loginRateLimiter } from "src/middlewares/loginRateLimiter.js";
import { forgotPasswordController } from "src/modules/auth/forgotPassword.controller.js";

const router = Router();

router.post("/login", loginRateLimiter , validateSchema(loginSchema), loginController);
router.post("/register", validateSchema(RegisterSchema), registerHandler);
router.post("/verify-email", validateSchema(VerifyEmailSchema), verifyEmailHandler);
router.post('/forgot-password', validateSchema(forgotPasswordSchema), forgotPasswordController);
router.post("/verify-otp", verifyOtpController);
router.post("/resend-verification", resendVerificationController)
router.post('/refresh', refreshController);
router.post('/logout', logoutController);

export default router;
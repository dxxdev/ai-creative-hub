import { Router } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  RegisterSchema,
  resetPasswordSchema,
  VerifyEmailSchema,
} from "@repo/shared";
import { validateSchema } from "../middlewares/validateSchema.js";
import { registerHandler, verifyEmailHandler } from "../controllers/auth.controller.js";
import { verifyOtpController } from "../modules/auth/verifyOtp.controller.js";
import { resendVerificationController } from "../modules/auth/resendVerification.controller.js";
import { loginController } from "../modules/auth/login.controller.js";
import { refreshController } from "../modules/auth/refresh.controller.js";
import { logoutController } from "../modules/auth/logout.controller.js";
import { loginRateLimiter } from "../middlewares/loginRateLimiter.js";
import { forgotPasswordController } from "../modules/auth/forgotPassword.controller.js";
import { resetPasswordController } from "../modules/auth/resetPassword.controller.js";

const router = Router();

router.post("/login", loginRateLimiter , validateSchema(loginSchema), loginController);
router.post("/register", validateSchema(RegisterSchema), registerHandler);
router.post("/verify-email", validateSchema(VerifyEmailSchema), verifyEmailHandler);
router.post('/forgot-password', validateSchema(forgotPasswordSchema), forgotPasswordController);
router.post('/reset-password', validateSchema(resetPasswordSchema), resetPasswordController);
router.post("/verify-otp", verifyOtpController);
router.post("/resend-verification", resendVerificationController)
router.post('/refresh', refreshController);
router.post('/logout', logoutController);

export default router;
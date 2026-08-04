import { Router } from "express";
import { RegisterSchema } from "@repo/shared";
import { validateSchema } from "../middlewares/validateSchema.js";
import { registerHandler } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", validateSchema(RegisterSchema), registerHandler);

export default router;
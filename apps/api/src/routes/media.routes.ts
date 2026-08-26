import { Router } from "express";
import { authGuard } from "../middlewares/authGuard.js";
import { uploadSingleImage, uploadHandler } from "../controllers/media.controller.js";

const router = Router();

// POST /media/upload — authGuard bilan himoyalangan, multer diskStorage
// orqali fayl to'g'ridan-to'g'ri storage/uploads/{userId}/ papkasiga yoziladi
router.post("/upload", authGuard, uploadSingleImage, uploadHandler);

export default router;
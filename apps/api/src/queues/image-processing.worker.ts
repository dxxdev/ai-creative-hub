import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/prisma.js";
import {
  ensureUserUploadDir,
  readStorageFile,
} from "../services/local-storage.service.js";
import { registerJobHandler } from "./job-queue.js";
import { emitPostProcessingStatus } from "../websocket/socket.js";

export const IMAGE_PROCESSING_JOB_TYPE = "image-processing";

export interface ImageProcessingJobPayload {
  postId: string;
  mediaPath: string;
}

const THUMBNAIL_WIDTHS = [300, 800] as const;
const THUMBNAIL_QUALITY = 80;

async function processImageJob(
  payload: ImageProcessingJobPayload,
): Promise<void> {
  const { postId, mediaPath } = payload;

  const userId = path.dirname(mediaPath);
  const ext = path.extname(mediaPath);
  const uuid = path.basename(mediaPath, ext);

  try {
    const originalBuffer = await readStorageFile(mediaPath);
    const userDir = await ensureUserUploadDir(userId);
    const metadata = await sharp(originalBuffer).metadata();

    const thumbnailRelativePathByWidth: Record<number, string> = {};

    await Promise.all(
      THUMBNAIL_WIDTHS.map(async (width) => {
        const fileName = `${uuid}-${width}.webp`;
        const outputPath = path.join(userDir, fileName);

        await sharp(originalBuffer)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: THUMBNAIL_QUALITY })
          .toFile(outputPath);

        thumbnailRelativePathByWidth[width] = `${userId}/${fileName}`;
      }),
    );

    const thumbnailPath = thumbnailRelativePathByWidth[300];
    const largeMediaPath = thumbnailRelativePathByWidth[800];

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        thumbnailPath,
        mediaPath: largeMediaPath,
        status: "PUBLISHED",
      },
      select: { authorId: true },
    });

    console.log(
      `✅ [image-processing] postId=${postId}: ${THUMBNAIL_WIDTHS.join("px, ")}px thumbnail'lar yaratildi (${userId}/)`,
    );

    // Real-time bildirishnoma: postni yaratgan foydalanuvchining
    // xonasiga ("user:{authorId}", agar u hozir onlayn bo'lsa)
    // "tayyor" statusini yuboramiz.
    emitPostProcessingStatus(updatedPost.authorId, { postId, status: "published" });
  } catch (error) {
    console.error(
      `❌ [image-processing] postId=${postId} uchun ishlov berishda xato:`,
      error instanceof Error ? error.message : error,
    );

    try {
      const failedPost = await prisma.post.update({
        where: { id: postId },
        data: { status: "FAILED" },
        select: { authorId: true },
      });

      emitPostProcessingStatus(failedPost.authorId, { postId, status: "failed" });
    } catch (updateError) {
      console.error(
        `❌ [image-processing] postId=${postId} statusini FAILED'ga o'tkazishda ham xato:`,
        updateError instanceof Error ? updateError.message : updateError,
      );
    }
  }
}

registerJobHandler<ImageProcessingJobPayload>(
  IMAGE_PROCESSING_JOB_TYPE,
  processImageJob,
);
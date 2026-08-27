/**
 * apps/api/src/queues/image-processing.worker.ts
 *
 * "image-processing" turidagi job'larni qayta ishlovchi worker.
 *
 * Job payload: { postId, mediaPath } — POST /posts (IMAGE) orqali
 * post PROCESSING holatida yaratilgandan so'ng, posts.service.ts
 * shu payload bilan job-queue.ts'ga job qo'shadi (enqueue).
 *
 * Bu fayl modul yuklanganda (import qilinganda) o'z-o'zini
 * registerJobHandler orqali "image-processing" turi uchun ro'yxatdan
 * o'tkazadi — shuning uchun uni faqat bir marta, server.ts'da
 * import qilish kifoya (side-effect import).
 */

import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/prisma.js";
import { UPLOAD_ROOT } from "../services/local-storage.service.js";
import { registerJobHandler } from "./job-queue.js";

export const IMAGE_PROCESSING_JOB_TYPE = "image-processing";

export interface ImageProcessingJobPayload {
  postId: string;
  mediaPath: string;
}

const THUMBNAIL_MAX_WIDTH = 600;
const THUMBNAIL_QUALITY = 80;

/**
 * Berilgan mediaPath (masalan "{userId}/{uuid}.jpg") uchun thumbnail
 * faylning nisbiy yo'lini hisoblab chiqaradi: xuddi shu papkada,
 * "-thumb.webp" qo'shimchasi bilan (masalan "{userId}/{uuid}-thumb.webp").
 */
function buildThumbnailRelativePath(mediaPath: string): string {
  const dir = path.dirname(mediaPath);
  const ext = path.extname(mediaPath);
  const base = path.basename(mediaPath, ext);
  const thumbFileName = `${base}-thumb.webp`;

  // Forward-slash bilan — local-storage.service.ts'dagi
  // toRelativeStoragePath natijasi bilan bir xil formatga mos.
  return dir === "." ? thumbFileName : `${dir}/${thumbFileName}`;
}

async function processImageJob(payload: ImageProcessingJobPayload): Promise<void> {
  const { postId, mediaPath } = payload;

  const absoluteMediaPath = path.join(UPLOAD_ROOT, mediaPath);
  const thumbnailRelativePath = buildThumbnailRelativePath(mediaPath);
  const absoluteThumbnailPath = path.join(UPLOAD_ROOT, thumbnailRelativePath);

  try {
    const image = sharp(absoluteMediaPath);
    const metadata = await image.metadata();

    await image
      .clone()
      .resize({ width: THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toFile(absoluteThumbnailPath);

    await prisma.post.update({
      where: { id: postId },
      data: {
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        thumbnailPath: thumbnailRelativePath,
        status: "PUBLISHED",
      },
    });

    console.log(`✅ [image-processing] postId=${postId} muvaffaqiyatli qayta ishlandi`);
  } catch (error) {
    console.error(
      `❌ [image-processing] postId=${postId} uchun ishlov berishda xato:`,
      error instanceof Error ? error.message : error,
    );

    // Postni FAILED holatiga o'tkazishga urinamiz — bu ham
    // muvaffaqiyatsiz bo'lsa (masalan postId endi mavjud emas),
    // shunchaki log qilib qo'yamiz, worker qulamaydi.
    try {
      await prisma.post.update({
        where: { id: postId },
        data: { status: "FAILED" },
      });
    } catch (updateError) {
      console.error(
        `❌ [image-processing] postId=${postId} statusini FAILED'ga o'tkazishda ham xato:`,
        updateError instanceof Error ? updateError.message : updateError,
      );
    }
  }
}

registerJobHandler<ImageProcessingJobPayload>(IMAGE_PROCESSING_JOB_TYPE, processImageJob);
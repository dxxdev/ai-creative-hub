/**
 * apps/api/src/queues/image-processing.queue.ts
 *
 * IMAGE post'lar uchun in-process (xotiradagi) job navbati.
 *
 * MUHIM: bu — V1 STUB. Loyiha tashqi navbat xizmati (Redis/BullMQ)
 * o'rniga ilova ichidagi oddiy in-process job runner (xotiradagi
 * navbat + async worker funksiyasi) arxitekturasidan foydalanadi —
 * shuning uchun bu yerda BullMQ emas, oddiy massiv + async worker
 * ishlatilgan (email.queue.ts'dagi BullMQ'dan farqli).
 *
 * TODO (4-kun): processImageJob() ichida haqiqiy ishlov berish
 * qo'shiladi:
 *   - mediaPath orqali faylni diskdan o'qish
 *   - o'lchamlarni (width/height) aniqlash
 *   - thumbnailPath generatsiya qilish (masalan sharp kutubxonasi bilan)
 *   - Post.status'ni "PROCESSING" dan "PUBLISHED" ga o'tkazish
 *     (yoki xatoda "FAILED" ga)
 *
 * Hozircha faqat navbat interfeysi mavjud — posts.service.ts shu
 * interfeys orqali job qo'shadi, worker esa vaqtincha faqat log qiladi.
 */

export interface ImageProcessingJobData {
  postId: string;
  mediaPath: string;
}

const queue: ImageProcessingJobData[] = [];
let isProcessing = false;

/** Yangi image-processing job'ni navbatga qo'shadi va workerni ishga tushiradi (agar u hali ishlamayotgan bo'lsa). */
export function enqueueImageProcessingJob(data: ImageProcessingJobData): void {
  queue.push(data);
  void runWorker();
}

async function runWorker(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    let job: ImageProcessingJobData | undefined;
    while ((job = queue.shift())) {
      try {
        await processImageJob(job);
      } catch (error) {
        console.error(
          `❌ Image processing: postId=${job.postId} uchun xato:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    isProcessing = false;
  }
}

// TODO (4-kun): to'liq ishlov berish logikasi shu yerga yoziladi.
async function processImageJob(job: ImageProcessingJobData): Promise<void> {
  console.log(
    `[image-processing] TODO (4-kun): postId=${job.postId}, mediaPath=${job.mediaPath}`,
  );
}
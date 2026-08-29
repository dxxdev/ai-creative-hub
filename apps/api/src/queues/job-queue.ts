/**
 * apps/api/src/queues/job-queue.ts
 *
 * Umumiy, xotirada (in-memory) ishlaydigan job navbati.
 *
 * Loyiha tashqi navbat xizmati (Redis/BullMQ) o'rniga ilova ichidagi
 * oddiy in-process job runner arxitekturasidan foydalanadi: barcha
 * job'lar oddiy massivda saqlanadi va Node'ning event loop'ida
 * (setImmediate orqali) ketma-ket qayta ishlanadi — alohida process,
 * tashqi xizmat yoki qo'shimcha infratuzilma talab qilinmaydi.
 *
 * QAYTA URINISH (retry): agar handler xato tashlasa, job avtomatik
 * ravishda eksponensial backoff bilan qayta navbatga qo'yiladi
 * (5000ms → 10000ms, ya'ni har urinishda 2 baravar). Jami 3 marta
 * muvaffaqiyatsiz bo'lsa (1 dastlabki + 2 qayta urinish), job "failed"
 * deb belgilanadi va alohida log yoziladi — bu qatorda navbat butunlay
 * to'xtamaydi, faqat o'sha bitta job tashlab yuboriladi.
 *
 * Foydalanish:
 *   1. Worker modul o'zini ro'yxatdan o'tkazadi:
 *      registerJobHandler("image-processing", async (payload) => { ... });
 *   2. Chaqiruvchi kod job qo'shadi:
 *      enqueue("image-processing", { postId, mediaPath });
 *
 * MUHIM: bu — jarayon ichidagi (in-process) navbat, shuning uchun
 * server qayta ishga tushirilsa (restart/deploy), hali qayta
 * ishlanmagan (shu jumladan retry kutayotgan) job'lar YO'QOLADI
 * (durable emas). V1/MVP doirasi uchun bu qabul qilinadi; kelajakda
 * kattaroq ishonchlilik kerak bo'lsa, Redis/BullMQ kabi tashqi,
 * saqlanuvchi navbatga o'tish kerak bo'ladi.
 */

export interface Job<TPayload = unknown> {
  jobType: string;
  payload: TPayload;
  /**
   * Shu job uchun hozirgacha qilingan urinishlar soni (0'dan boshlanadi,
   * har bir urinishdan oldin +1 qilinadi). Chaqiruvchi kod (`enqueue`)
   * buni o'zi bermaydi — navbat ichida avtomatik boshqariladi.
   */
  attempts?: number;
}

export type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void>;

/**
 * Job barcha ruxsat etilgan urinishlarni (MAX_ATTEMPTS marta) ishlatib
 * bo'lib, baribir muvaffaqiyatsiz tugagandan KEYIN chaqiriladigan
 * ixtiyoriy callback. Masalan `image-processing` worker buni Post
 * yozuvini DB'da "FAILED" deb belgilash va foydalanuvchiga real-time
 * bildirishnoma yuborish uchun ishlatadi — vaqtinchalik xatolar
 * (masalan bir martalik disk/tarmoq nosozligi) sabab foydalanuvchi
 * bekorga "xato" bildirishnomasini olmasligi uchun bu faqat retry'lar
 * tugagandan so'ng ishga tushadi.
 */
export type JobFinalFailureHandler<TPayload = unknown> = (
  payload: TPayload,
  error: unknown,
) => Promise<void> | void;

const handlers = new Map<string, JobHandler>();
const finalFailureHandlers = new Map<string, JobFinalFailureHandler>();
const queue: Job[] = [];
let isProcessing = false;

/** Jami ruxsat etilgan urinishlar soni (1 dastlabki + 2 qayta urinish). */
const MAX_ATTEMPTS = 3;
/** Birinchi qayta urinishdan oldingi kutish vaqti (millisekund). */
const INITIAL_BACKOFF_MS = 5000;
/** Har bir keyingi urinishda kutish vaqti necha barobar oshishi. */
const BACKOFF_MULTIPLIER = 2;

/**
 * Berilgan urinish raqami uchun eksponensial backoff kutish vaqtini
 * hisoblaydi: 1-urinish muvaffaqiyatsiz → 5000ms, 2-urinish
 * muvaffaqiyatsiz → 10000ms va hokazo.
 */
function computeBackoffMs(failedAttemptNumber: number): number {
  return INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** (failedAttemptNumber - 1);
}

/**
 * Job o'zining barcha ruxsat etilgan urinishlarini (MAX_ATTEMPTS marta)
 * ishlatib bo'lib, baribir muvaffaqiyatsiz tugagach chaqiriladi.
 *
 * Hozircha bu shunchaki strukturaviy formatda console.error orqali log
 * yozadi. KELAJAKDA: bu yerdagi log yozuvini oddiy fayl (masalan
 * `failed-jobs.log`ga JSON qatorlar sifatida qo'shib borish) yoki DB
 * jadvaliga (masalan Prisma orqali `FailedJob` modeli: jobType, payload,
 * error, failedAt) yozishga almashtirish mumkin — shunda admin panelda
 * "muvaffaqiyatsiz job'lar" ro'yxatini ko'rsatish va kerak bo'lsa qo'lda
 * qayta ishga tushirish imkoniyati qo'shiladi.
 */
function logJobFailure(job: Job, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  console.error(
    `🔴 Job navbati: "${job.jobType}" job'i ${MAX_ATTEMPTS} marta urinishdan so'ng ham muvaffaqiyatsiz tugadi va "failed" deb belgilandi.`,
    {
      jobType: job.jobType,
      payload: job.payload,
      attempts: job.attempts,
      error: message,
      failedAt: new Date().toISOString(),
    },
  );
}

/**
 * Berilgan `jobType` uchun ishlov beruvchi funksiyani ro'yxatdan
 * o'tkazadi. Har bir job turi uchun faqat bitta handler bo'lishi
 * mumkin — qayta ro'yxatdan o'tkazish eskisini almashtiradi.
 *
 * `onFinalFailure` — ixtiyoriy. Berilsa, job MAX_ATTEMPTS marta
 * muvaffaqiyatsiz bo'lib, butunlay "failed" deb belgilangandan KEYIN
 * bir marta chaqiriladi (masalan DB statusini yangilash yoki
 * foydalanuvchiga bildirishnoma yuborish uchun).
 */
export function registerJobHandler<TPayload = unknown>(
  jobType: string,
  handler: JobHandler<TPayload>,
  onFinalFailure?: JobFinalFailureHandler<TPayload>,
): void {
  handlers.set(jobType, handler as JobHandler);

  if (onFinalFailure) {
    finalFailureHandlers.set(jobType, onFinalFailure as JobFinalFailureHandler);
  }
}

/**
 * Yangi job'ni navbatga qo'shadi va workerni ishga tushiradi (agar u
 * hali ishlamayotgan bo'lsa). Job darhol emas, Node'ning event
 * loop'idagi navbatdagi tick'da (setImmediate) qayta ishlana boshlaydi
 * — shu bilan enqueue() chaqiruvchi kodni bloklamaydi.
 */
export function enqueue<TPayload = unknown>(jobType: string, payload: TPayload): void {
  queue.push({ jobType, payload, attempts: 0 });
  setImmediate(runWorker);
}

/**
 * Muvaffaqiyatsiz tugagan job'ni eksponensial backoff kutgandan so'ng
 * qaytadan navbatga qo'yadi. `setTimeout` ishlatilgani uchun bu vaqt
 * davomida navbatdagi boshqa job'lar odatdagidek ishlanishda davom
 * etaveradi — faqat shu bitta job kutib turadi.
 */
function scheduleRetry(job: Job, delayMs: number): void {
  setTimeout(() => {
    queue.push(job);
    void runWorker();
  }, delayMs);
}

async function runWorker(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    let job: Job | undefined;
    while ((job = queue.shift())) {
      const handler = handlers.get(job.jobType);

      if (!handler) {
        console.error(
          `❌ Job navbati: "${job.jobType}" turi uchun ro'yxatdan o'tgan handler topilmadi.`,
        );
        continue;
      }

      job.attempts = (job.attempts ?? 0) + 1;

      try {
        await handler(job.payload);
      } catch (error) {
        const isLastAttempt = job.attempts >= MAX_ATTEMPTS;

        if (isLastAttempt) {
          logJobFailure(job, error);

          const onFinalFailure = finalFailureHandlers.get(job.jobType);
          if (onFinalFailure) {
            try {
              await onFinalFailure(job.payload, error);
            } catch (hookError) {
              console.error(
                `❌ Job navbati: "${job.jobType}" uchun onFinalFailure hook'ida xato:`,
                hookError instanceof Error ? hookError.message : hookError,
              );
            }
          }

          continue;
        }

        const backoffMs = computeBackoffMs(job.attempts);

        console.warn(
          `⚠️  Job navbati: "${job.jobType}" job'i ${job.attempts}-urinishda muvaffaqiyatsiz bo'ldi ` +
            `(${error instanceof Error ? error.message : error}). ${backoffMs}ms'dan so'ng qayta uriniladi ` +
            `(${job.attempts}/${MAX_ATTEMPTS}).`,
        );

        scheduleRetry(job, backoffMs);
      }
    }
  } finally {
    isProcessing = false;
  }
}
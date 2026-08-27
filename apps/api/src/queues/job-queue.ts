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
 * Foydalanish:
 *   1. Worker modul o'zini ro'yxatdan o'tkazadi:
 *      registerJobHandler("image-processing", async (payload) => { ... });
 *   2. Chaqiruvchi kod job qo'shadi:
 *      enqueue("image-processing", { postId, mediaPath });
 *
 * MUHIM: bu — jarayon ichidagi (in-process) navbat, shuning uchun
 * server qayta ishga tushirilsa (restart/deploy), hali qayta
 * ishlanmagan job'lar YO'QOLADI (durable emas). V1/MVP doirasi uchun
 * bu qabul qilinadi; kelajakda kattaroq ishonchlilik kerak bo'lsa,
 * Redis/BullMQ kabi tashqi, saqlanuvchi navbatga o'tish kerak bo'ladi.
 */

export interface Job<TPayload = unknown> {
  jobType: string;
  payload: TPayload;
}

export type JobHandler<TPayload = unknown> = (payload: TPayload) => Promise<void>;

const handlers = new Map<string, JobHandler>();
const queue: Job[] = [];
let isProcessing = false;

/**
 * Berilgan `jobType` uchun ishlov beruvchi funksiyani ro'yxatdan
 * o'tkazadi. Har bir job turi uchun faqat bitta handler bo'lishi
 * mumkin — qayta ro'yxatdan o'tkazish eskisini almashtiradi.
 */
export function registerJobHandler<TPayload = unknown>(
  jobType: string,
  handler: JobHandler<TPayload>,
): void {
  handlers.set(jobType, handler as JobHandler);
}

/**
 * Yangi job'ni navbatga qo'shadi va workerni ishga tushiradi (agar u
 * hali ishlamayotgan bo'lsa). Job darhol emas, Node'ning event
 * loop'idagi navbatdagi tick'da (setImmediate) qayta ishlana boshlaydi
 * — shu bilan enqueue() chaqiruvchi kodni bloklamaydi.
 */
export function enqueue<TPayload = unknown>(jobType: string, payload: TPayload): void {
  queue.push({ jobType, payload });
  setImmediate(runWorker);
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

      try {
        await handler(job.payload);
      } catch (error) {
        console.error(
          `❌ Job navbati: "${job.jobType}" job'ini bajarishda xato:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    isProcessing = false;
  }
}
/**
 * apps/api/src/queues/sync-view-counts.job.ts
 *
 * `view-counter.service.ts`dagi xotiradagi (in-memory) Map'da to'plangan
 * post ko'rishlar sonini `node-cron` yordamida DAVRIY ravishda (har
 * SYNC_INTERVAL_CRON'da) Postgres'ga BATCH tarzda yozadigan fon vazifasi.
 *
 * Bu fayl side-effect import sifatida ishlatiladi: import qilinishi
 * bilanoq (server.ts'da) cron jadvali darhol ro'yxatdan o'tkaziladi va
 * ishga tushadi — alohida "start()" chaqirish shart emas.
 *
 * ⚠️ MUHIM CHEKLOV (bitta server instansi uchun): bu job faqat shu
 * process xotirasidagi Map'ni o'qiydi, shuning uchun u ham
 * `view-counter.service.ts`dagi kabi FAQAT bitta server instansi
 * uchun to'g'ri ishlaydi. Ko'p instansli (horizontal scaling) muhitda
 * har bir instansi o'zining Map'ini alohida sinxronlaydi — bu odatiy
 * hisoblagich sifatida muammo emas (sonlar yo'qolmaydi, faqat
 * instansilar orasida bo'linib yoziladi), lekin bunday muhitda umuman
 * jarayon-ichi Map o'rniga umumiy joyda (masalan Redis) saqlanadigan
 * hisoblagichga o'tish tavsiya etiladi (batafsili:
 * `view-counter.service.ts`dagi izohga qarang).
 */

import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import {
  takeSnapshotAndClear,
  mergePendingViewCounts,
} from "../services/view-counter.service.js";

/**
 * Sinxronlash chastotasi: har 5 daqiqada bir marta. Kerak bo'lsa,
 * kelajakda buni ham (SMTP/DB kabi) env.ts orqali konfiguratsiya
 * qilinadigan qiymatga aylantirish mumkin — V1/MVP doirasida oddiy
 * qat'iy konstanta yetarli.
 */
const SYNC_INTERVAL_CRON = "*/5 * * * *";

/**
 * Xotiradagi Map'dan olingan snapshot'ni Postgres'ga bitta DB
 * tranzaksiyasi ichida, batch tarzda yozadi.
 *
 * Har bir post uchun alohida `UPDATE ... SET viewCount = viewCount +
 * N` (increment, ustidan yozish emas) bajariladi — shunda agar shu
 * postga boshqa manbadan ham (masalan kelajakda qo'shilishi mumkin
 * bo'lgan boshqa hisoblagich) parallel yozuv bo'lsa ham, natija
 * to'g'ri qo'shiladi, hech narsa ustidan bosilib qolmaydi.
 *
 * Barcha update'lar bitta `$transaction` ichida yuboriladi — bu shart
 * emas (har bir update mustaqil, bir-biriga bog'liq emas), lekin
 * Prisma'ga barcha so'rovlarni bitta DB round-trip guruhida
 * yuborishga imkon berib, ko'p sonli alohida `await` chaqiruvlariga
 * qaraganda samaraliroq ishlaydi.
 *
 * Agar tranzaksiya xato bersa (masalan vaqtincha DB uzilishi), ushbu
 * snapshot'dagi barcha sonlar `mergePendingViewCounts()` orqali
 * qaytadan xotiradagi Map'ga qo'shib qo'yiladi — shunda ular
 * yo'qolmay, keyingi (5 daqiqadan keyingi) sinxronlash urinishida
 * qayta yuboriladi.
 */
export async function flushPendingViewCountsToDb(): Promise<void> {
  const snapshot = takeSnapshotAndClear();

  if (snapshot.size === 0) return; // to'plangan yangi ko'rish yo'q — DB'ga bekorga murojaat qilmaymiz

  try {
    await prisma.$transaction(
      Array.from(snapshot, ([postId, count]) =>
        prisma.post.update({
          where: { id: postId },
          data: { viewCount: { increment: count } },
        }),
      ),
    );

    console.log(
      `👁️  view-counter: ${snapshot.size} ta post uchun ko'rishlar soni Postgres'ga sinxronlandi.`,
    );
  } catch (error) {
    // Muvaffaqiyatsiz snapshot'ni butunlay tashlab yubormaymiz —
    // keyingi davrda qayta urinib ko'rish uchun Map'ga qaytarib
    // qo'shamiz (mavjud, shu oraliqda kelgan yangi hisoblarga QO'SHIB,
    // ularning ustidan yozmasdan).
    mergePendingViewCounts(snapshot);

    console.error(
      `🔴 view-counter: ${snapshot.size} ta post uchun ko'rishlar sonini Postgres'ga yozishda xato yuz berdi. ` +
        `Hisoblagichlar keyingi sinxronlash davri uchun qayta navbatga qo'yildi.`,
      error instanceof Error ? error.message : error,
    );
  }
}

// Cron jadvalini shu modul import qilinishi bilanoq ro'yxatdan
// o'tkazamiz (server.ts'da boshqa worker/queue modullari kabi
// side-effect import sifatida ishlatiladi).
cron.schedule(SYNC_INTERVAL_CRON, () => {
  void flushPendingViewCountsToDb();
});
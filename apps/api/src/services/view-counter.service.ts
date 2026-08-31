/**
 * apps/api/src/services/view-counter.service.ts
 *
 * GET /posts/:id har chaqirilganda Post.viewCount'ni bevosita DB'ga
 * yozish o'rniga, shu server jarayoni XOTIRASIDA (in-memory) yuritiladigan
 * oddiy hisoblagich: Map<postId, shu davrda to'plangan ko'rishlar soni>.
 *
 * Oqim:
 *   1. Har bir GET /posts/:id so'rovida `incrementPendingViewCount(postId)`
 *      chaqiriladi — bu FAQAT shu Map'dagi sonni +1 oshiradi, DB'ga
 *      hech qanday yozuv bo'lmaydi (shuning uchun juda tez, so'rovni
 *      bloklamaydi).
 *   2. Davriy ravishda (queues/sync-view-counts.job.ts'dagi node-cron
 *      job'i orqali) `takeSnapshotAndClear()` chaqiriladi — bu joriy
 *      Map'ning nusxasini qaytaradi va asl Map'ni darhol bo'shatadi,
 *      shunda keyingi davr hisoblagichlari noldan boshlanadi.
 *   3. Agar shu snapshot'ni Postgres'ga yozish muvaffaqiyatsiz tugasa,
 *      job `mergePendingViewCounts()` orqali hisoblanmagan sonlarni
 *      qaytadan Map'ga qo'shib qo'yishi mumkin — shunda ular keyingi
 *      sinxronlash davrida qayta urinilib, yo'qolmaydi.
 *
 * ⚠️ MUHIM CHEKLOV (bitta server instansi uchun): bu yechim FAQAT bitta
 * Node.js process (bitta server instansi) doirasida to'g'ri ishlaydi,
 * chunki Map — jarayon xotirasida, boshqa process/instansiyalar bilan
 * UMUMIY EMAS. Agar ilova gorizontal masshtablansa (load balancer
 * ortida bir nechta API instansi/pod ishga tushirilsa), har bir
 * instansi o'zining ALOHIDA Map'iga ega bo'ladi va ular bir-biridan
 * bexabar hisoblaydi (masalan 3 ta instansi bo'lsa, umumiy ko'rishlar
 * sonining faqat 1/3 qismi har bir Map'da to'planadi, lekin baribir
 * hammasi oxir-oqibat DB'ga yoziladi — shuning uchun sonlar YO'QOLMAYDI,
 * faqat instansilar orasida "bo'linib" turadi, bu view-counter uchun
 * odatda muammo emas). Bundan tashqari, server qayta ishga tushirilsa
 * (restart/deploy), hali sinxronlanmagan hisoblagichlar Map bilan
 * birga YO'QOLADI (durable emas) — V1/MVP doirasida bu qabul qilinadi.
 *
 * KELAJAKDA (ko'p instansli / horizontal scaling muhitida): bu
 * jarayon-ichi Map o'rniga barcha instansilar ko'ra oladigan UMUMIY
 * joyda saqlanadigan hisoblagich kerak bo'ladi — masalan Redis (INCR /
 * HINCRBY buyrug'i bilan, keyin shu Redis'dan davriy ravishda Postgres'ga
 * sinxronlash), shunda instansilar soni qancha bo'lishidan qat'iy nazar
 * hisoblagich yagona va izchil bo'ladi.
 */

/** postId -> shu sinxronlash davrida to'plangan (hali DB'ga yozilmagan) ko'rishlar soni. */
const pendingViewCounts = new Map<string, number>();

/**
 * Berilgan post uchun kutilayotgan ko'rishlar hisoblagichini 1'ga
 * oshiradi. DB'ga hech qanday murojaat qilmaydi — faqat xotiradagi
 * Map ustida sinxron amal, shuning uchun har HTTP so'rovda chaqirish
 * uchun juda arzon/tez.
 */
export function incrementPendingViewCount(postId: string): void {
  const current = pendingViewCounts.get(postId) ?? 0;
  pendingViewCounts.set(postId, current + 1);
}

/**
 * Joriy Map'ning nusxasini (snapshot) qaytaradi va asl Map'ni DARHOL
 * bo'shatadi (clear). "Snapshot olish" va "tozalash" bitta sinxron
 * funksiyada, bo'linmagan holda bajariladi — Node.js bitta threadli
 * event loop'ga ega bo'lgani uchun bu ikki amal orasida boshqa hech
 * qanday kod (masalan yangi `incrementPendingViewCount` chaqiruvi)
 * kirib ulgurmaydi, ya'ni "race condition" yo'q: har bir ko'rish aynan
 * bitta snapshot'ga tegishli bo'ladi, hech qachon ikkalasiga ham yoki
 * hech qaysisiga ham tushib qolmaydi.
 *
 * Agar hozircha hech qanday ko'rish to'planmagan bo'lsa, bo'sh Map
 * qaytariladi (chaqiruvchi — sync job — bu holatda DB'ga umuman
 * murojaat qilmasligi kerak).
 */
export function takeSnapshotAndClear(): Map<string, number> {
  const snapshot = new Map(pendingViewCounts);
  pendingViewCounts.clear();
  return snapshot;
}

/**
 * Oldin `takeSnapshotAndClear()` orqali olingan, lekin DB'ga
 * yozilmasdan xato bilan tugagan hisoblagichlarni qaytadan joriy
 * Map'ga QO'SHADI (ustidan yozmaydi — mavjud qiymatga qo'shiladi,
 * chunki shu oraliqda yangi ko'rishlar allaqachon kelib ulgurgan
 * bo'lishi mumkin). Shunda o'sha ko'rishlar butunlay yo'qolmay,
 * keyingi sinxronlash davrida qayta urinib ko'riladi.
 */
export function mergePendingViewCounts(counts: Map<string, number>): void {
  for (const [postId, count] of counts) {
    const current = pendingViewCounts.get(postId) ?? 0;
    pendingViewCounts.set(postId, current + count);
  }
}
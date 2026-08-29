import hljs from "highlight.js";

/**
 * apps/api/src/services/language-detection.service.ts
 *
 * CODE post'lar uchun dasturlash tilini avtomatik aniqlash xizmati.
 *
 * highlight.js kutubxonasining o'zining ichki heuristikasi
 * (`hljs.highlightAuto`) yordamida berilgan kod matnidan eng ehtimoliy
 * tilni aniqlaydi. highlight.js kod ichidagi kalit so'zlar, sintaksis
 * naqshlari va boshqa belgilar asosida tillarni sinab ko'radi va eng
 * yuqori "relevance" (mos kelish) ballini olgan tilni tanlaydi.
 *
 * MUHIM (aniqlik haqida): `hljs.highlightAuto()` cheklovsiz chaqirilsa
 * (barcha ~190 ta qo'llab-quvvatlanadigan til bilan), qisqa yoki
 * umumiy kod parchalari ba'zan noto'g'ri, kam ishlatiladigan tillar
 * bilan aralashtirilib yuboriladi (masalan qisqa TypeScript kodi
 * "pgsql" yoki "qml" deb noto'g'ri aniqlanishi mumkin edi — sinovda
 * shu kuzatildi). Shuning uchun aniqlash pastdagi `CANDIDATE_LANGUAGES`
 * — kod ulashish platformasiga mos, real amaliyotda eng ko'p
 * ishlatiladigan tillar — ro'yxati bilan CHEKLANGAN. Bu aniqlikni
 * sezilarli oshiradi, chunki kamdan-kam ishlatiladigan/o'xshash
 * sintaksisli tillar (masalan qml, pgsql) nomzodlar orasidan olib
 * tashlanadi.
 */

/**
 * Avtomatik aniqlash uchun nomzod tillar ro'yxati. Kerak bo'lsa, bu
 * yerga yangi til qo'shish (yoki olib tashlash) mumkin — highlight.js
 * shu tillarning barchasini o'z ichiga oladi (paket to'liq bundle
 * bilan o'rnatilgan, alohida til fayllarini ulashning hojati yo'q).
 */
const CANDIDATE_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "dart",
  "scala",
  "html",
  "xml",
  "css",
  "scss",
  "json",
  "yaml",
  "markdown",
  "bash",
  "sql",
  "graphql",
  "dockerfile",
];

/**
 * highlight.js hech qanday tilni yetarlicha ishonch bilan aniqlay
 * olmaganda (masalan kod juda qisqa yoki noaniq bo'lsa) qaytariladigan
 * standart qiymat.
 */
const FALLBACK_LANGUAGE = "plaintext";

/**
 * Berilgan kod matni uchun eng ehtimoliy dasturlash tilini aniqlaydi.
 *
 * USTUVORLIK: agar `userSelectedLanguage` berilgan bo'lsa (ya'ni
 * foydalanuvchi post yaratishda tilni qo'lda tanlagan bo'lsa), u
 * har doim ustunlik qiladi — bu holatda `hljs.highlightAuto()`
 * umuman chaqirilmaydi (keraksiz hisoblashdan qochish uchun) va
 * foydalanuvchi tanlovi bo'sh joylardan tozalangan holda
 * to'g'ridan-to'g'ri qaytariladi.
 *
 * @param code - tili aniqlanishi kerak bo'lgan kod matni.
 * @param userSelectedLanguage - foydalanuvchi qo'lda tanlagan til
 *   nomi (ixtiyoriy). `undefined`, `null` yoki bo'sh satr bo'lsa,
 *   avtomatik aniqlashga o'tiladi.
 * @returns highlight.js formatidagi til nomi (masalan "typescript",
 *   "python", "javascript", "cpp"), yoki tilni aniqlab bo'lmasa
 *   `"plaintext"`.
 */
export function detectLanguage(
  code: string,
  userSelectedLanguage?: string | null,
): string {
  const trimmedUserSelection = userSelectedLanguage?.trim();
  if (trimmedUserSelection) {
    return trimmedUserSelection;
  }

  if (!code || !code.trim()) {
    return FALLBACK_LANGUAGE;
  }

  const result = hljs.highlightAuto(code, CANDIDATE_LANGUAGES);

  return result.language ?? FALLBACK_LANGUAGE;
}
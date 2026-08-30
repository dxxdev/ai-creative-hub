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

/**
 * Berilgan kodni highlight.js yordamida `<span class="hljs-...">`
 * teglari bilan belgilangan HTML'ga aylantiradi (syntax highlighting).
 *
 * KESHLASH STRATEGIYASI: bu funksiyaning o'zi hech narsani keshlamaydi
 * — har chaqirilganda qaytadan hisoblaydi. Buning o'rniga, CODE
 * post'ning kodi (`codeContent`) yaratilgandan keyin o'zgarmasligi
 * sababli (V1'da post tahrirlashda `codeContent` maydoni
 * o'zgartirilmaydi — buni `UpdatePostSchema` ta'minlaydi), chaqiruvchi
 * kod (`posts.service.ts`) bu funksiyani FAQAT post birinchi marta
 * yaratilayotganda bir marta chaqiradi va natijani to'g'ridan-to'g'ri
 * `Post.codeHighlightHtml` ustuniga saqlaydi. Shundan keyingi barcha
 * o'qishlarda (`getPostById`, `listPosts`) bu tayyor HTML bazadan
 * to'g'ridan-to'g'ri qaytariladi — highlight.js qayta ishga
 * tushirilmaydi. Alohida keshlash xizmati (Redis va h.k.) shart emas,
 * chunki Postgres jadvalining o'zi bu yerda "kesh" vazifasini
 * bajaradi (bir marta yoz, cheksiz marta o'qi).
 *
 * @param code - highlight qilinishi kerak bo'lgan kod matni.
 * @param language - highlight.js til nomi (odatda `detectLanguage()`
 *   natijasi). highlight.js bu tilni tanimasa (masalan yozuv xatosi
 *   yoki qo'llab-quvvatlanmaydigan nom bo'lsa), xato tashlash o'rniga
 *   avtomatik aniqlashga (`highlightAuto`) tushiladi — shu bilan
 *   noma'lum til nomi post yaratishni butunlay to'xtatib qo'ymaydi.
 * @returns tayyor HTML satri, to'g'ridan-to'g'ri
 *   `Post.codeHighlightHtml`ga saqlash uchun tayyor.
 */
export function highlightCode(code: string, language: string): string {
  const normalizedLanguage = language?.trim();

  if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
    return hljs.highlight(code, {
      language: normalizedLanguage,
      // Foydalanuvchi kodi har doim ham 100% sintaktik to'g'ri
      // bo'lavermaydi (masalan qisman/tugallanmagan kod parchasi).
      // `ignoreIllegals: true` bo'lmasa, highlight.js bunday holatlarda
      // xato tashlab, butun post yaratishni buzib qo'yishi mumkin edi.
      ignoreIllegals: true,
    }).value;
  }

  // Til noma'lum/tanilmagan bo'lsa (masalan bo'sh yoki xato nom),
  // highlight.js'ning o'z avtomatik aniqlashiga tayanamiz — bu hech
  // qachon xato tashlamaydi, faqat pastroq sifatli natija berishi
  // mumkin (highlight'siz oddiy matn sifatida qaytishi mumkin).
  return hljs.highlightAuto(code).value;
}
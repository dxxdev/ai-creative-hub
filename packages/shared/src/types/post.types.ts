import type { ContentType } from "../schemas/post.schema.js";

// ---------------------------------------------------------------------------
// AUTHOR — post ichida ko'rsatiladigan muallif haqida qisqacha ma'lumot
// ---------------------------------------------------------------------------

export interface PostAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
}

// ---------------------------------------------------------------------------
// POST SUMMARY — feed/explore/profil kartochkalarida ishlatiladigan qisqa shakl
//
// Eslatma: thumbnailUrl — DB'da saqlanadigan `thumbnailPath` (diskdagi
// nisbiy fayl yo'li, masalan storage/uploads/xyz.webp) dan backend
// tomonidan hosil qilingan, static middleware orqali xizmat qiladigan
// nisbiy URL (masalan `/uploads/xyz.webp`). Client bevosita shu URL'ni
// <img src> sifatida ishlatadi; disk yo'lining o'zi clientga chiqmaydi.
// ---------------------------------------------------------------------------

export interface PostSummary {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  contentType: ContentType;
  author: PostAuthor;
  likeCount: number;
  remixCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// POST DETAIL — bitta postni to'liq ko'rish sahifasida ishlatiladigan shakl
// PostSummary'ni extend qiladi va to'liq kontent maydonlarini qo'shadi
//
// Eslatma: mediaUrl — xuddi thumbnailUrl kabi, DB'dagi `mediaPath`
// (diskdagi nisbiy fayl yo'li) dan backend tomonidan hosil qilingan
// nisbiy URL (masalan `/uploads/xyz.png`).
// ---------------------------------------------------------------------------

export interface PostDetail extends PostSummary {
  description: string | null;
  mediaUrl: string | null;
  codeContent: string | null;
  codeLanguage: string | null;
  width: number | null;
  height: number | null;
  tags: string[];
  viewerHasLiked: boolean;
}
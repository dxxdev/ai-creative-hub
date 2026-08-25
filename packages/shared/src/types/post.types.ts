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
// ---------------------------------------------------------------------------

export interface PostSummary {
  id: string;
  title: string;
  thumbnailPath: string | null;
  contentType: ContentType;
  author: PostAuthor;
  likeCount: number;
  remixCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// POST DETAIL — bitta postni to'liq ko'rish sahifasida ishlatiladigan shakl
// PostSummary'ni extend qiladi va to'liq kontent maydonlarini qo'shadi
// ---------------------------------------------------------------------------

export interface PostDetail extends PostSummary {
  description: string | null;
  mediaPath: string | null;
  codeContent: string | null;
  codeLanguage: string | null;
  width: number | null;
  height: number | null;
  tags: string[];
  viewerHasLiked: boolean;
}
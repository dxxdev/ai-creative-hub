// ---------------------------------------------------------------------------
// SOCKET.IO EVENT KONTRAKTLARI
//
// apps/api (websocket/socket.ts, queues/image-processing.worker.ts) va
// apps/web (lib/socket.ts) o'rtasida ishlatiladigan event nomlari va
// payload tiplari shu yerda markazlashtirilgan — shunda ikkala tomon ham
// bir xil string literal va shakldan foydalanadi (yozuv xatosi bo'lsa,
// TypeScript build vaqtida ushlab qoladi).
// ---------------------------------------------------------------------------

/** Server'dan clientga yuboriladigan barcha socket event nomlari. */
export const SOCKET_EVENTS = {
  POST_PROCESSING_STATUS: "post:processing_status",
} as const;

/**
 * IMAGE post'lar uchun fon ishlovi (image-processing worker) tugagach
 * yuboriladigan event payload'i. Faqat shu postni yaratgan foydalanuvchining
 * xonasiga ("user:{userId}") yuboriladi — boshqa foydalanuvchilar buni
 * ko'rmaydi.
 */
export interface PostProcessingStatusEvent {
  postId: string;
  status: "published" | "failed";
}
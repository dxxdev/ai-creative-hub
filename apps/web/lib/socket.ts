/**
 * apps/web/lib/socket.ts
 *
 * Butun frontend bo'ylab ishlatiladigan yagona (singleton) Socket.IO
 * client. Backend'dagi apps/api/src/websocket/socket.ts bilan bir xil
 * server — Express HTTP serveriga o'rnatilgan, alohida WebSocket xizmati
 * emas — shuning uchun bazaviy URL xuddi `lib/api-client.ts`dagi kabi
 * `NEXT_PUBLIC_API_URL`dan olinadi.
 *
 * Ulanish faqat foydalanuvchi tizimga kirgan (access token mavjud)
 * bo'lganda ochiladi: token handshake'da `auth.token` sifatida
 * yuboriladi, backend uni tekshirib, socketni foydalanuvchining shaxsiy
 * xonasiga ("user:{userId}") qo'shadi.
 */

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL aniqlanmagan. Iltimos, .env.local faylini apps/web/.env.local.example namunasiga qarab to'ldiring.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

/**
 * Berilgan access token bilan socket ulanishini o'rnatadi (agar hali
 * ulanmagan bo'lsa) va uni qaytaradi. Allaqachon ulangan bo'lsa, xuddi
 * shu instansiya qaytariladi — har bir chaqiruvda yangi ulanish
 * ochilmaydi.
 */
export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;

  socket = io(getSocketBaseUrl(), {
    auth: { token: accessToken },
    withCredentials: true,
    autoConnect: true,
    // Access token ~15 daqiqada eskiradi; ulanish shu vaqt ichida
    // uzilib qolsa, socket.io o'zi eksponensial backoff bilan qayta
    // ulanishga urinadi (standart sozlamalar yetarli).
  });

  return socket;
}

/** Joriy socket ulanishini yopadi va tozalaydi (masalan logout yoki sessiya tugaganda). */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
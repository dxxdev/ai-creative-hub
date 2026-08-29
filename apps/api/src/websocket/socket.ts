import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { SOCKET_EVENTS, type PostProcessingStatusEvent } from "@repo/shared";
import { verifyAccessToken } from "../services/token.service.js";

/**
 * apps/api/src/websocket/socket.ts
 *
 * Real-time bildirishnomalar uchun Socket.IO server.
 *
 * MUHIM: bu — tashqi xizmat EMAS. Socket.IO server Express ilovasi
 * ishlatayotgan bitta HTTP serverga (node:http) to'g'ridan-to'g'ri
 * o'rnatiladi (server.ts'da `initSocket(httpServer)` orqali) — alohida
 * process, port yoki infratuzilma talab qilinmaydi.
 *
 * XONALAR (rooms): har bir ulangan client, JWT access token orqali
 * autentifikatsiyadan o'tgach, avtomatik ravishda faqat o'ziga tegishli
 * `user:{userId}` xonasiga qo'shiladi.
 */

let io: SocketIOServer | null = null;

function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** handshake'dan JWT access tokenni oladi: `auth.token` yoki `Authorization: Bearer <token>` header. */
function extractToken(socket: Socket): string | undefined {
  const authToken = socket.handshake.auth?.token as string | undefined;
  if (authToken) return authToken;

  const header = socket.handshake.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  return undefined;
}

/**
 * Socket.IO serverni berilgan HTTP serverga o'rnatadi va ishga tushiradi.
 * `server.ts` ichida, `httpServer.listen(...)`dan oldin bir marta
 * chaqiriladi.
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      // MUHIM: server.ts'dagi Express CORS sozlamasi bilan bir xil origin.
      origin: "http://localhost:3001",
      credentials: true,
    },
  });

  // Handshake middleware: har bir ulanish urinishida access tokenni
  // tekshiradi. Token yaroqsiz/yo'q bo'lsa, ulanishning o'zi rad etiladi
  // (client "connect_error" eventini oladi).
  io.use((socket, next) => {
    const token = extractToken(socket);

    if (!token) {
      next(new Error("Access token topilmadi"));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Access token yaroqsiz yoki muddati tugagan"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));

    console.log(`🔌 Socket ulandi: userId=${userId}, socketId=${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket uzildi: userId=${userId}, sabab=${reason}`);
    });
  });

  console.log("✅ Socket.IO server ishga tushdi (Express HTTP serveriga o'rnatilgan)");

  return io;
}

/**
 * Berilgan foydalanuvchining xonasiga (uning barcha ochiq ulanishlariga)
 * `post:processing_status` eventini yuboradi (masalan image-processing
 * worker tugagach). Agar Socket.IO hali ishga tushmagan bo'lsa yoki
 * foydalanuvchi hech qanday ulanishga ega bo'lmasa (offline), xatosiz jim
 * o'tkazib yuboriladi — real-time bildirishnoma faqat "bonus" hisoblanadi,
 * asosiy oqim (Post statusini DB'da yangilash) buning bilan bog'liq emas.
 */
export function emitPostProcessingStatus(
  userId: string,
  payload: PostProcessingStatusEvent,
): void {
  if (!io) {
    console.warn(
      `⚠️  Socket.IO hali ishga tushmagan, "${SOCKET_EVENTS.POST_PROCESSING_STATUS}" event yuborilmadi (userId=${userId})`,
    );
    return;
  }

  io.to(userRoom(userId)).emit(SOCKET_EVENTS.POST_PROCESSING_STATUS, payload);
}

/** Kerak bo'lganda xom Socket.IO server instansiyasiga to'g'ridan-to'g'ri kirish uchun. */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO hali ishga tushirilmagan (initSocket() chaqirilmagan).");
  }
  return io;
}
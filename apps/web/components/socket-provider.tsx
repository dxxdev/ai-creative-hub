/**
 * apps/web/components/socket-provider.tsx
 *
 * Foydalanuvchi tizimga kirgan bo'lsa, socket ulanishini ochadi va
 * backend'dan kelgan `post:processing_status` eventini tinglaydi —
 * IMAGE post fon ishlovi (thumbnail generatsiya) tugagach, "Post
 * tayyor!" (yoki xatolik) bildirishnomasini ko'rsatadi.
 *
 * `apps/web/app/layout.tsx`da butun ilova atrofida o'rnatiladi, shunda
 * foydalanuvchi qaysi sahifada bo'lishidan qat'iy nazar bildirishnomani
 * oladi.
 */

"use client";

import { useEffect, useState } from "react";
import { SOCKET_EVENTS, type PostProcessingStatusEvent } from "@repo/shared";
import { useAuthStore } from "@/store/auth.store";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { NotificationToast, type ToastItem } from "./notification-toast";

let nextToastId = 1;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(accessToken);

    function handleProcessingStatus(payload: PostProcessingStatusEvent) {
      const message =
        payload.status === "published"
          ? "Post tayyor! 🎉"
          : "Postni qayta ishlashda xatolik yuz berdi.";

      setToasts((prev) => [
        ...prev,
        {
          id: nextToastId++,
          message,
          tone: payload.status === "published" ? "success" : "error",
        },
      ]);
    }

    function handleConnectError(error: Error) {
      console.warn("⚠️ Socket ulanish xatosi:", error.message);
    }

    socket.on(SOCKET_EVENTS.POST_PROCESSING_STATUS, handleProcessingStatus);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off(SOCKET_EVENTS.POST_PROCESSING_STATUS, handleProcessingStatus);
      socket.off("connect_error", handleConnectError);
    };
  }, [accessToken, isAuthenticated]);

  // Sahifadan butunlay chiqilganda (component unmount) ulanishni yopamiz.
  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  return (
    <>
      {children}
      <NotificationToast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
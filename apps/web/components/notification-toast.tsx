/**
 * apps/web/components/notification-toast.tsx
 *
 * Ekranning pastki o'ng burchagida ko'rsatiladigan, o'zi yopiladigan
 * bildirishnoma (toast) steki. Real-time socket eventlar (masalan
 * "post:processing_status") uchun ishlatiladi — <SocketProvider>
 * shu komponentni render qiladi.
 */

"use client";

import { useEffect } from "react";

export interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
}

const TONE_CLASSES: Record<ToastItem["tone"], string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

const AUTO_DISMISS_MS = 5000;

interface NotificationToastProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function NotificationToast({ toasts, onDismiss }: NotificationToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-md ${TONE_CLASSES[toast.tone]}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
        aria-label="Bildirishnomani yopish"
      >
        Yopish
      </button>
    </div>
  );
}
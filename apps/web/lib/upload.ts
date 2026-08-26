// apps/web/lib/upload.ts
/**
 * apps/web/lib/upload.ts
 *
 * Faylni backend'dagi POST /media/upload endpointiga to'g'ridan-to'g'ri
 * yuklaydi. `apps/web/lib/api-client.ts`dagi markazlashtirilgan `fetch`
 * asosidagi klientdan FARQLI o'laroq, bu yerda ataylab XMLHttpRequest
 * ishlatiladi — chunki `fetch` hozircha yuklash (upload) progressini
 * kuzatish imkonini bermaydi, `XMLHttpRequest.upload.onprogress` esa
 * beradi.
 *
 * Konventsiyalar `api-client.ts` bilan bir xil:
 * - Base URL `NEXT_PUBLIC_API_URL`'dan olinadi.
 * - Access token `useAuthStore`'dan olinib, `Authorization: Bearer`
 *   header'i sifatida yuboriladi.
 * - Cookie'lar (`withCredentials`) yuboriladi.
 */

import { useAuthStore } from "@/store/auth.store";

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0–100 oralig'idagi butun son. `total` noma'lum bo'lsa (lengthComputable=false) chaqirilmaydi. */
  percent: number;
}

export interface UploadFileResult {
  /** Diskdagi nisbiy fayl yo'li — keyinchalik POST /posts'da CreatePostSchema.fileId sifatida yuboriladi. */
  fileId: string;
  /** Faylni to'g'ridan-to'g'ri ko'rsatish uchun ishlatiladigan nisbiy URL (masalan /uploads/...). */
  publicUrl: string;
}

export interface UploadFileToServerOptions {
  /** Yuklash progressi o'zgarganda chaqiriladi. */
  onProgress?: (progress: UploadProgress) => void;
  /** Yuklashni bekor qilish uchun (masalan foydalanuvchi "Bekor qilish" bosganda). */
  signal?: AbortSignal;
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_URL aniqlanmagan. Iltimos, .env.local faylini apps/web/.env.local.example namunasiga qarab to'ldiring.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

interface UploadSuccessBody {
  success: true;
  data: UploadFileResult;
}

interface UploadErrorBody {
  error?: string;
  [key: string]: unknown;
}

/**
 * Faylni FormData ("file" maydoni) sifatida POST /media/upload'ga
 * yuklaydi va progressni kuzatib boradi.
 *
 * @example
 * const result = await uploadFileToServer(file, {
 *   onProgress: ({ percent }) => setProgress(percent),
 * });
 * console.log(result.fileId, result.publicUrl);
 */
export function uploadFileToServer(
  file: File,
  options: UploadFileToServerOptions = {},
): Promise<UploadFileResult> {
  const { onProgress, signal } = options;

  return new Promise<UploadFileResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Yuklash bekor qilindi", "AbortError"));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBaseUrl()}/media/upload`, true);
    xhr.withCredentials = true;

    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    }
    xhr.setRequestHeader("Accept", "application/json");

    function handleAbort() {
      xhr.abort();
    }

    if (signal) {
      signal.addEventListener("abort", handleAbort);
    }

    function cleanup() {
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
    }

    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (!onProgress || !event.lengthComputable) return;

      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    };

    xhr.onload = () => {
      cleanup();

      let body: UploadSuccessBody | UploadErrorBody | null = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }

      const isSuccess = xhr.status >= 200 && xhr.status < 300;

      if (isSuccess) {
        const data = (body as UploadSuccessBody | null)?.data;

        if (!data?.fileId || !data?.publicUrl) {
          reject(new Error("Serverdan noto'g'ri javob formati keldi"));
          return;
        }

        resolve(data);
        return;
      }

      const message =
        (body as UploadErrorBody | null)?.error ??
        `Fayl yuklashda xatolik (HTTP ${xhr.status})`;
      reject(new Error(message));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("Serverga ulanib bo'lmadi. Internet aloqangizni tekshiring."));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Yuklash bekor qilindi", "AbortError"));
    };

    xhr.send(formData);
  });
}
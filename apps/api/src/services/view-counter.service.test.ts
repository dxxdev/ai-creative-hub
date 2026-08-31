import { describe, it, expect, beforeEach } from "vitest";
import {
  incrementPendingViewCount,
  takeSnapshotAndClear,
  mergePendingViewCounts,
} from "./view-counter.service.js";

describe("view-counter.service", () => {
  // Har bir test boshida modul darajasidagi Map'ni bo'shatib olamiz —
  // aks holda testlar bir-biriga ta'sir qilishi mumkin (Map butun test
  // fayli davomida bitta jarayon xotirasida saqlanadi).
  beforeEach(() => {
    takeSnapshotAndClear();
  });

  it("yangi post uchun birinchi chaqiruvda hisoblagichni 1'ga o'rnatadi", () => {
    incrementPendingViewCount("post-1");

    const snapshot = takeSnapshotAndClear();

    expect(snapshot.get("post-1")).toBe(1);
  });

  it("bir xil post uchun ketma-ket chaqiruvlarni to'g'ri qo'shadi", () => {
    incrementPendingViewCount("post-1");
    incrementPendingViewCount("post-1");
    incrementPendingViewCount("post-1");

    const snapshot = takeSnapshotAndClear();

    expect(snapshot.get("post-1")).toBe(3);
  });

  it("turli postlar uchun hisoblagichlarni alohida yuritadi", () => {
    incrementPendingViewCount("post-1");
    incrementPendingViewCount("post-2");
    incrementPendingViewCount("post-1");

    const snapshot = takeSnapshotAndClear();

    expect(snapshot.get("post-1")).toBe(2);
    expect(snapshot.get("post-2")).toBe(1);
    expect(snapshot.size).toBe(2);
  });

  it("takeSnapshotAndClear() chaqirilgandan keyin Map'ni bo'shatadi", () => {
    incrementPendingViewCount("post-1");
    takeSnapshotAndClear();

    const secondSnapshot = takeSnapshotAndClear();

    expect(secondSnapshot.size).toBe(0);
  });

  it("mergePendingViewCounts() qiymatlarni ustidan yozmasdan, mavjudiga qo'shadi", () => {
    // Sync job muvaffaqiyatsiz bo'lib, snapshot'ni qaytarayotganda,
    // shu oraliqda YANGI ko'rishlar allaqachon kelib ulgurgan bo'lishi
    // mumkin bo'lgan holatni simulyatsiya qilamiz.
    incrementPendingViewCount("post-1"); // yangi so'rov, xato paytida keldi

    mergePendingViewCounts(new Map([["post-1", 5]])); // muvaffaqiyatsiz snapshot qaytarilmoqda

    const snapshot = takeSnapshotAndClear();

    expect(snapshot.get("post-1")).toBe(6); // 1 (yangi) + 5 (qaytarilgan) — hech biri yo'qolmagan
  });

  it("mergePendingViewCounts() Map'da bo'lmagan postId uchun yangi yozuv yaratadi", () => {
    mergePendingViewCounts(new Map([["post-9", 2]]));

    const snapshot = takeSnapshotAndClear();

    expect(snapshot.get("post-9")).toBe(2);
  });
});
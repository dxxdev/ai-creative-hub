import { describe, it, expect, vi, beforeEach } from "vitest";

// node-cron'ni mock qilamiz — aks holda modul import qilinganda haqiqiy
// `cron.schedule(...)` ishga tushib, test process'ini "ochiq" ushlab
// turadigan doimiy taymer yaratib qo'yardi. Bu yerda faqat
// `flushPendingViewCountsToDb()`ning o'zini to'g'ridan-to'g'ri
// chaqirib testlaymiz, cron jadvalining o'zi emas.
vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $transaction: vi.fn(),
    post: { update: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma.js";
import {
  incrementPendingViewCount,
  takeSnapshotAndClear,
} from "../services/view-counter.service.js";
import { flushPendingViewCountsToDb } from "./sync-view-counts.job.js";

describe("sync-view-counts.job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    takeSnapshotAndClear(); // testlar orasida view-counter Map'ini tozalash
  });

  it("hisoblagich bo'sh bo'lsa, DB'ga umuman murojaat qilmaydi", async () => {
    await flushPendingViewCountsToDb();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("to'plangan hisoblagichlarni bitta $transaction orqali DB'ga yozadi", async () => {
    incrementPendingViewCount("post-1");
    incrementPendingViewCount("post-1");
    incrementPendingViewCount("post-2");
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await flushPendingViewCountsToDb();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: "post-1" },
      data: { viewCount: { increment: 2 } },
    });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: "post-2" },
      data: { viewCount: { increment: 1 } },
    });
  });

  it("muvaffaqiyatli yozuvdan keyin hisoblagichlarni Map'da qoldirmaydi", async () => {
    incrementPendingViewCount("post-1");
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await flushPendingViewCountsToDb();

    const snapshotAfter = takeSnapshotAndClear();
    expect(snapshotAfter.size).toBe(0);
  });

  it("DB xatosi bo'lsa, hisoblagichlarni yo'qotmasdan Map'ga qaytaradi", async () => {
    incrementPendingViewCount("post-1");
    incrementPendingViewCount("post-1");
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB vaqtincha ishlamayapti"));

    await flushPendingViewCountsToDb();

    const snapshotAfter = takeSnapshotAndClear();
    expect(snapshotAfter.get("post-1")).toBe(2); // keyingi urinish uchun saqlanib qolgan
  });

  it("DB xatosidan keyin, shu oraliqda kelgan yangi ko'rishlarning ustidan yozmaydi", async () => {
    incrementPendingViewCount("post-1");
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB vaqtincha ishlamayapti"));

    await flushPendingViewCountsToDb(); // bu snapshot (count=1) xato bilan tugaydi va qaytariladi

    incrementPendingViewCount("post-1"); // "xato paytida" kelgan yangi ko'rish

    const snapshotAfter = takeSnapshotAndClear();
    expect(snapshotAfter.get("post-1")).toBe(2); // 1 (qaytarilgan) + 1 (yangi), yo'qolmagan
  });
});
import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import { ZodError, z } from "zod";
import { AppError } from "../utils/AppError.js";
import { validatePostsSchema, postsErrorHandler } from "./posts-response.middleware.js";

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("validatePostsSchema", () => {
  const schema = z.object({ title: z.string().min(1) });

  it("to'g'ri body'da next()ni chaqiradi, javob yubormaydi", () => {
    const req = { body: { title: "Salom" } } as any;
    const res = mockRes();
    const next = vi.fn();

    validatePostsSchema(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("noto'g'ri body'da success:false bilan 400 qaytaradi", () => {
    const req = { body: { title: "" } } as any;
    const res = mockRes();
    const next = vi.fn();

    validatePostsSchema(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.any(String) }),
    );
  });
});

describe("postsErrorHandler", () => {
  it("AppError uchun uning statusCode'i va success:false bilan javob beradi", () => {
    const res = mockRes();

    postsErrorHandler(new AppError("Post topilmadi", 404), {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Post topilmadi" });
  });

  it("ZodError uchun success:false bilan 400 qaytaradi", () => {
    const res = mockRes();
    const zodError = z.object({ title: z.string() }).safeParse({}).error as ZodError;

    postsErrorHandler(zodError, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Validatsiya xatosi" }),
    );
  });

  it("kutilmagan xato uchun success:false bilan 500 qaytaradi", () => {
    const res = mockRes();

    postsErrorHandler(new Error("nimadir buzildi"), {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Serverda kutilmagan xatolik" });
  });
});
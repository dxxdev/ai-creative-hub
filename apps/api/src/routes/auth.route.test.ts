import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../services/auth.service.js", () => {
  class EmailAlreadyExistsError extends Error {
    constructor() {
      super("Bu email allaqachon ro'yxatdan o'tgan");
      this.name = "EmailAlreadyExistsError";
    }
  }
  return { EmailAlreadyExistsError, registerUser: vi.fn() };
});

vi.mock("../services/otp.service.js", () => ({
  createEmailVerificationOtp: vi.fn().mockResolvedValue("123456"),
}));

vi.mock("../queues/email.queue.js", () => ({
  queueOtpEmail: vi.fn().mockResolvedValue(undefined),
}));

import { registerUser, EmailAlreadyExistsError } from "../services/auth.service.js";
import { queueOtpEmail } from "../queues/email.queue.js";
import authRoutes from "./auth.routes.js";
import { errorHandler } from "../middlewares/errorHandler.middleware.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  return app;
}

const VALID_BODY = {
  email: "test@example.com",
  password: "Password1!",
  confirmPassword: "Password1!",
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("to'g'ri ma'lumot bilan 201 va yaratilgan foydalanuvchini qaytaradi", async () => {
    const mockUser = {
      id: "user-1",
      email: VALID_BODY.email,
      username: "test_ab12",
      status: "PENDING_VERIFICATION",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    vi.mocked(registerUser).mockResolvedValue(mockUser as never);

    const res = await request(buildApp()).post("/api/auth/register").send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      id: "user-1",
      email: VALID_BODY.email,
      status: "PENDING_VERIFICATION",
    });
    expect(registerUser).toHaveBeenCalledWith({
      email: VALID_BODY.email,
      password: VALID_BODY.password,
    });
    expect(queueOtpEmail).toHaveBeenCalledWith(VALID_BODY.email, "123456");
  });

  it("noto'g'ri email formati bilan 400 va aniq xato xabarini qaytaradi", async () => {
    const res = await request(buildApp())
      .post("/api/auth/register")
      .send({ ...VALID_BODY, email: "notanemail" });

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBeDefined();
    expect(res.body.errors.email[0]).toMatch(/email/i);
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("zaif parol bilan 400 va aniq xato xabarini qaytaradi", async () => {
    const res = await request(buildApp())
      .post("/api/auth/register")
      .send({ email: "test2@example.com", password: "weak", confirmPassword: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
    expect(res.body.errors.password.length).toBeGreaterThan(0);
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("dublikat email bilan 409 va aniq xato xabarini qaytaradi", async () => {
    vi.mocked(registerUser).mockRejectedValue(new EmailAlreadyExistsError());

    const res = await request(buildApp())
      .post("/api/auth/register")
      .send({ ...VALID_BODY, email: "band@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Bu email allaqachon ro'yxatdan o'tgan");
  });
});
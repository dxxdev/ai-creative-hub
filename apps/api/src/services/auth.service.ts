import bcrypt from "bcryptjs";
import crypto from 'node:crypto';
import { prisma } from "../lib/prisma.js";
import { verifyEmailOtp } from "./otp.service.js";
import { UserStatus } from "@prisma/client";
import { AppError } from "../utils/AppError.js";
import {
  generateAccessToken,
  generateTokenPair,
  verifyRefreshToken,
} from "./token.service.js";
import type { LoginInput, ResetPasswordInput } from "@repo/shared";
import redis from "../lib/redis.js";
import { queuePasswordResetEmail } from "../queues/email.queue.js";

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 30;
const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("Bu email allaqachon ro'yxatdan o'tgan");
    this.name = "EmailAlreadyExistsError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("Foydalanuvchi topilmadi");
    this.name = "UserNotFoundError";
  }
}

export class EmailAlreadyVerifiedError extends Error {
  constructor() {
    super("Email allaqachon tasdiqlangan");
    this.name = "EmailAlreadyVerifiedError";
  }
}

export class InvalidOrExpiredOtpError extends Error {
  constructor() {
    super("Noto'g'ri yoki muddati o'tgan tasdiqlash kodi");
    this.name = "InvalidOrExpiredOtpError";
  }
}

export interface VerifyUserEmailInput {
  email: string;
  otpCode: string;
}

interface LoginMeta {
  userAgent?: string;
  ipAddress?: string;
}

function generateUsernameFromEmail(email: string): string {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "") || "user";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}_${suffix}`;
}

async function findAvailableUsername(email: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateUsernameFromEmail(email);
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
    });
    if (!taken) return candidate;
  }
  return `${generateUsernameFromEmail(email)}_${Date.now()}`;
}

export interface RegisterUserInput {
  email: string;
  password: string;
}

export async function registerUser(input: RegisterUserInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) throw new EmailAlreadyExistsError();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const username = await findAvailableUsername(input.email);

  return prisma.user.create({
    data: {
      email: input.email,
      username,
      passwordHash,
      status: "PENDING_VERIFICATION",
    },
  });
}

export async function verifyUserEmail(input: VerifyUserEmailInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new UserNotFoundError();

  if (user.status === "ACTIVE") throw new EmailAlreadyVerifiedError();

  const isValid = await verifyEmailOtp(user.id, input.otpCode);
  if (!isValid) throw new InvalidOrExpiredOtpError();

  return prisma.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE" },
  });
}

export async function login({ email, password }: LoginInput, meta: LoginMeta) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      status: true,
    },
  });

  // Xavfsizlik uchun: email topilmadimi yoki parol noto'g'rimi — bir xil xato xabari
  if (!user) {
    throw new AppError("Email yoki parol noto'g'ri", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("Email yoki parol noto'g'ri", 401);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      "Email hali tasdiqlanmagan. Iltimos, emailingizni tasdiqlang",
      403,
    );
  }

  const { accessToken, refreshToken } = generateTokenPair({
    userId: user.id,
    email: user.email,
  });

  const refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      status: user.status,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshTokenFromCookie: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenFromCookie);
  } catch {
    throw new AppError("Refresh token yaroqsiz yoki muddati tugagan", 401);
  }

  const sessions = await prisma.session.findMany({
    where: {
      userId: payload.userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      refreshTokenHash: true,
    },
  });

  if (sessions.length === 0) {
    throw new AppError("Sessiya topilmadi yoki muddati tugagan", 401);
  }

  let matchedSession: { id: string } | null = null;

  for (const session of sessions) {
    const isMatch = await bcrypt.compare(
      refreshTokenFromCookie,
      session.refreshTokenHash,
    );
    if (isMatch) {
      matchedSession = { id: session.id };
      break;
    }
  }

  if (!matchedSession) {
    throw new AppError("Refresh token yaroqsiz", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AppError("Foydalanuvchi topilmadi yoki faol emas", 401);
  }

  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
  });

  return { accessToken };
}

export async function logout(refreshTokenFromCookie: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenFromCookie);
  } catch {
    return;
  }

  const sessions = await prisma.session.findMany({
    where: { userId: payload.userId },
    select: { id: true, refreshTokenHash: true },
  });

  for (const session of sessions) {
    const isMatch = await bcrypt.compare(
      refreshTokenFromCookie,
      session.refreshTokenHash,
    );
    if (isMatch) {
      await prisma.session.delete({ where: { id: session.id } });
      break;
    }
  }
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const redisKey = `password_reset:${resetToken}`;

  await redis.set(redisKey, user.id, 'EX', PASSWORD_RESET_TTL_SECONDS);

  const resetLink = `${process.env.WEB_APP_URL}/reset-password?token=${resetToken}`;

  await queuePasswordResetEmail(user.email, resetLink);
}

export async function resetPassword({
  token,
  newPassword,
}: ResetPasswordInput): Promise<void> {
  const redisKey = `password_reset:${token}`;

  const userId = await redis.get(redisKey);

  if (!userId) {
    throw new AppError('Yaroqsiz yoki muddati o\'tgan havola', 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Xavfsizlik uchun: parol o'zgargandan keyin barcha qurilmalardagi
  // sessiyalar bekor qilinadi — kimdir eski parol bilan sessiya ochib
  // qolgan bo'lsa ham, endi ishlamaydi
  await prisma.session.deleteMany({ where: { userId } });

  // Token bir martalik bo'lishi kerak — muvaffaqiyatli ishlatilgandan
  // keyin Redis'dan o'chiriladi
  await redis.del(redisKey);
}
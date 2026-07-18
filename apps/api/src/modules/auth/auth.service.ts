import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthProvider, User, UserStatus } from "@ai-creative-hub/database";
import * as bcrypt from "bcrypt";
import { randomBytes, randomInt } from "crypto";
import { createHash } from "crypto";
import { EmailQueueService } from "../../common/mail/email-queue.service";
import { RedisService } from "../../common/redis/redis.service";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import type { GoogleProfilePayload } from "./strategies/google.strategy";

const BCRYPT_COST_FACTOR = 12;
const OTP_TTL_SECONDS = 10 * 60; // 10 daqiqa (PRD 1.3.1, band 5)
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 soat (PRD 1.3.4, band 1)

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  // ---------------------------------------------------------------------
  // A) Email/Password ro'yxatdan o'tish
  // ---------------------------------------------------------------------

  async register(email: string, password: string): Promise<{ message: string }> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException("Bu email bilan hisob allaqachon mavjud.");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    const user = await this.usersService.createWithCredentials(email, passwordHash);

    await this.sendVerificationOtp(user);

    return { message: "Ro'yxatdan o'tish muvaffaqiyatli. Emailingizga tasdiqlash kodi yuborildi." };
  }

  private async sendVerificationOtp(user: User): Promise<void> {
    const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.redis.setWithTtl(`email_verify:${user.id}`, otp, OTP_TTL_SECONDS);
    await this.emailQueue.enqueueVerificationEmail(user.email, otp);
  }

  async verifyEmail(email: string, otp: string): Promise<TokenPair & { user: User }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Foydalanuvchi topilmadi.");
    }
    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException("Email allaqachon tasdiqlangan.");
    }

    const storedOtp = await this.redis.get(`email_verify:${user.id}`);
    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException("Tasdiqlash kodi noto'g'ri yoki muddati tugagan.");
    }

    await this.redis.delete(`email_verify:${user.id}`);
    const activatedUser = await this.usersService.activate(user.id);

    const tokens = await this.issueTokenPair(activatedUser);
    return { ...tokens, user: activatedUser };
  }

  // ---------------------------------------------------------------------
  // B) Login
  // ---------------------------------------------------------------------

  async login(email: string, password: string): Promise<TokenPair & { user: User }> {
    const user = await this.usersService.findByEmail(email);

    // Umumiy xato xabari — email mavjud/mavjud emasligini oshkor qilmaslik uchun.
    const invalidCredentialsError = new UnauthorizedException("Email yoki parol noto'g'ri.");

    if (!user || !user.passwordHash) {
      // passwordHash yo'q = faqat Google orqali ro'yxatdan o'tgan foydalanuvchi.
      throw invalidCredentialsError;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw invalidCredentialsError;
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      await this.sendVerificationOtp(user);
      throw new ForbiddenException(
        "Email hali tasdiqlanmagan. Yangi tasdiqlash kodi emailingizga yuborildi.",
      );
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
      throw new ForbiddenException("Hisobingiz cheklangan. Qo'llab-quvvatlash xizmatiga murojaat qiling.");
    }

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user };
  }

  // ---------------------------------------------------------------------
  // C) Google OAuth
  // ---------------------------------------------------------------------

  async validateOrCreateGoogleUser(profile: GoogleProfilePayload): Promise<User> {
    const existingAccount = await this.prisma.client.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: profile.googleId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      return existingAccount.user;
    }

    const existingUserByEmail = await this.usersService.findByEmail(profile.email);
    if (existingUserByEmail) {
      // PRD 1.3.2, band 3: email mos kelsa, mavjud userga Google account bog'lanadi.
      await this.usersService.linkGoogleAccount(existingUserByEmail.id, profile.googleId);
      return existingUserByEmail;
    }

    return this.usersService.createFromGoogle(profile.email, profile.googleId);
  }

  async loginWithGoogle(user: User): Promise<TokenPair & { user: User; isFirstLogin: boolean }> {
    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user, isFirstLogin: !user.username };
  }

  // ---------------------------------------------------------------------
  // D) Token pair yaratish va Refresh/Logout
  // ---------------------------------------------------------------------

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, username: user.username, role: user.role },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m"),
      },
    );

    const session = await this.prisma.client.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: "PENDING", // pastda yangilanadi — session.id refresh payload'ga kerak
        expiresAt: this.refreshExpiryDate(),
      },
    });

    const refreshToken = this.jwt.sign(
      { sub: user.id, sessionId: session.id },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "30d"),
      },
    );

    await this.prisma.client.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(userId: string, sessionId: string, rawRefreshToken: string): Promise<TokenPair> {
    const session = await this.prisma.client.session.findUnique({ where: { id: sessionId } });

    if (
      !session ||
      session.revoked ||
      session.userId !== userId ||
      session.expiresAt < new Date() ||
      session.refreshTokenHash !== this.hashToken(rawRefreshToken)
    ) {
      throw new UnauthorizedException("Sessiya yaroqsiz. Qaytadan tizimga kiring.");
    }

    // Rotatsiya: eski sessiya bekor qilinadi, yangisi yaratiladi (token o'g'irlanishiga qarshi).
    await this.prisma.client.session.update({ where: { id: session.id }, data: { revoked: true } });

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Foydalanuvchi topilmadi.");
    }

    return this.issueTokenPair(user);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { revoked: true },
    });
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private refreshExpiryDate(): Date {
    const days = 30; // JWT_REFRESH_EXPIRES_IN bilan mos (default 30d)
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // ---------------------------------------------------------------------
  // E) Parolni tiklash (PRD 1.3.4)
  // ---------------------------------------------------------------------

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message: "Agar bu email ro'yxatdan o'tgan bo'lsa, tiklash havolasi yuborildi.",
    };

    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      // Email mavjudligini oshkor qilmaslik uchun bir xil javob qaytariladi.
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.client.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const resetUrl = `${this.config.get<string>("WEB_URL", "http://localhost:3000")}/reset-password?token=${rawToken}`;
    await this.emailQueue.enqueuePasswordResetEmail(user.email, resetUrl);

    return genericResponse;
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(rawToken);
    const resetToken = await this.prisma.client.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Tiklash havolasi yaroqsiz yoki muddati tugagan.");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST_FACTOR);

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.client.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Xavfsizlik: barcha mavjud sessiyalar bekor qilinadi (PRD 1.3.4, band 3).
      this.prisma.client.session.updateMany({
        where: { userId: resetToken.userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    return { message: "Parol muvaffaqiyatli yangilandi. Iltimos, qaytadan tizimga kiring." };
  }
}
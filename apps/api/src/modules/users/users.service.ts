import { Injectable } from "@nestjs/common";
import { AuthProvider, User, UserStatus } from "@ai-creative-hub/database";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({ where: { id } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.client.user.findUnique({ where: { username } });
  }

  /** Email/Password ro'yxatdan o'tish (PRD 1.3.1, band 3-4). Bo'sh Profile ham birga yaratiladi. */
  async createWithCredentials(email: string, passwordHash: string): Promise<User> {
    return this.prisma.client.user.create({
      data: {
        email,
        passwordHash,
        status: UserStatus.PENDING_VERIFICATION,
        accounts: {
          create: { provider: AuthProvider.CREDENTIALS, providerAccountId: email },
        },
        profile: { create: {} },
      },
    });
  }

  /** Google OAuth orqali birinchi marta kirgan foydalanuvchi (PRD 1.3.2, band 3). */
  async createFromGoogle(email: string, googleSub: string): Promise<User> {
    return this.prisma.client.user.create({
      data: {
        email,
        status: UserStatus.ACTIVE, // Google email'ni allaqachon tasdiqlagan
        accounts: {
          create: { provider: AuthProvider.GOOGLE, providerAccountId: googleSub },
        },
        profile: { create: {} },
      },
    });
  }

  /** Mavjud userga Google account'ni bog'lash (agar hali bog'lanmagan bo'lsa). */
  async linkGoogleAccount(userId: string, googleSub: string): Promise<void> {
    await this.prisma.client.account.upsert({
      where: { provider_providerAccountId: { provider: AuthProvider.GOOGLE, providerAccountId: googleSub } },
      update: {},
      create: { userId, provider: AuthProvider.GOOGLE, providerAccountId: googleSub },
    });
  }

  async activate(userId: string): Promise<User> {
    return this.prisma.client.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  }

  async setUsername(userId: string, username: string): Promise<User> {
    return this.prisma.client.user.update({
      where: { id: userId },
      data: { username },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
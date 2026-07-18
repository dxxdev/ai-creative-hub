import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./common/redis/redis.module";
import { MailModule } from "./common/mail/mail.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    // BullMQ ulanishi (Redis'ga) — MailModule shu asosidagi email-queue'ni ro'yxatdan o'tkazadi.
    BullModule.forRootAsync({
      useFactory: () => ({ connection: { url: process.env.REDIS_URL } }),
    }),

    // Register/login kabi endpointlarni brute-force'dan himoyalash uchun oddiy global rate-limit
    // (daqiqasiga 60 so'rov/IP). Auth controller'da nozikroq limitlar keyinroq qo'shiladi.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    PrismaModule,
    RedisModule,
    MailModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
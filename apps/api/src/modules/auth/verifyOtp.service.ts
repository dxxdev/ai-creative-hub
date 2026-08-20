import { PrismaClient, UserStatus } from '@prisma/client';
import { redis } from '../../lib/redis.js';
import { AppError } from '../../utils/AppError.js';
import { generateTokenPair } from '../../services/token.service.js';

const prisma = new PrismaClient();

interface VerifyOtpInput {
  userId: string;
  otp: string;
}

export async function verifyOtpAndActivateUser({ userId, otp }: VerifyOtpInput) {
  const redisKey = `email_verify:${userId}`;

  const storedOtp = await redis.get(redisKey);

  if (!storedOtp) {
    throw new AppError('OTP muddati tugagan yoki topilmadi', 400);
  }

  if (storedOtp !== otp) {
    throw new AppError("OTP noto'g'ri", 400);
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE },
    select: {
      id: true,
      email: true,
      status: true,
    },
  });

  await redis.del(redisKey);

  // Muvaffaqiyatli verify'dan so'ng access + refresh tokenlarni generatsiya qilamiz
  const { accessToken, refreshToken } = generateTokenPair({
    userId: updatedUser.id,
    email: updatedUser.email,
  });

  return {
    user: updatedUser,
    accessToken,
    refreshToken,
  };
}
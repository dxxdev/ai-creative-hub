import { PrismaClient, UserStatus } from '@prisma/client';
import { redis } from '../../lib/redis.js';
import { AppError } from '../../utils/AppError.js';
import { generateOtp } from '../../utils/otp.js'; // sizda mavjud bo'lishi kerak
import { sendVerificationEmail } from '../../lib/mailer.js'; // sizning email jo'natuvchi funksiyangiz

const prisma = new PrismaClient();

const COOLDOWN_SECONDS = 60;
const OTP_TTL_SECONDS = 15 * 60; // masalan, OTP 15 daqiqa amal qiladi — o'zingizga moslang

export async function resendVerification(email: string) {
  const cooldownKey = `resend_cooldown:${email}`;

  // 1. Rate-limit: atomik SET NX EX orqali
  // Agar key allaqachon mavjud bo'lsa, `set` natijasi null qaytaradi
  const acquired = await redis.set(cooldownKey, '1', 'EX', COOLDOWN_SECONDS, 'NX');

  if (!acquired) {
    // Qancha vaqt qolganini foydalanuvchiga aytish uchun TTL'ni olamiz
    const ttl = await redis.ttl(cooldownKey);
    throw new AppError(
      `Iltimos, qayta urinishdan oldin ${ttl} soniya kuting`,
      429
    );
  }

  try {
    // 2. Foydalanuvchini topish
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true },
    });

    // Xavfsizlik uchun: email mavjud yoki yo'qligini oshkor qilmaymiz
    if (!user) {
      // Cooldown baribir qo'yilgan holda jim qaytamiz (enumeration attack'dan himoya)
      return { message: 'Agar email mavjud bo\'lsa, tasdiqlash kodi yuborildi' };
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new AppError('Bu email allaqachon tasdiqlangan', 400);
    }

    // 3. Yangi OTP generatsiya qilish va Redis'ga yozish
    const otp = generateOtp(); // masalan 6 xonali kod
    const otpKey = `email_verify:${user.id}`;
    await redis.set(otpKey, otp, 'EX', OTP_TTL_SECONDS);

    // 4. Email yuborish
    await sendVerificationEmail(user.email, otp);

    return { message: 'Tasdiqlash kodi qayta yuborildi' };
  } catch (error) {
    // Agar OTP jarayonida xato bo'lsa, cooldown'ni bekor qilish mumkin
    // (ixtiyoriy — biznes qarorga bog'liq: xato bo'lsa ham cooldown qolsin desangiz, shu qatorni o'chiring)
    await redis.del(cooldownKey);
    throw error;
  }
}
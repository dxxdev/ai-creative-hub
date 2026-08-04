import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

/** BullMQ ishlatadigan queue nomi */
const QUEUE_NAME = "email";

/**
 * BullMQ'ga alohida Redis ulanish kerak: `maxRetriesPerRequest: null` bo'lishi
 * SHART, chunki Worker bloklovchi (blocking) buyruqlar orqali ishlaydi.
 * Shuning uchun `lib/redis.ts`dagi umumiy client'dan foydalanmay, mustaqil
 * ulanish yaratiladi.
 */
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

/**
 * SMTP orqali email yuboradigan nodemailer transporter.
 * Sozlamalar `.env`dagi SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS'dan olinadi.
 */
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/** "send-otp-email" job'i qabul qiladigan ma'lumotlar shakli */
export interface SendOtpEmailJobData {
  to: string;
  otp: string;
}

/**
 * "email" nomli BullMQ queue. Job'larni shu queue'ga qo'shish uchun
 * to'g'ridan-to'g'ri ishlatilmaydi — buning o'rniga `queueOtpEmail()`
 * funksiyasidan foydalaning.
 */
export const emailQueue = new Queue<SendOtpEmailJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

/**
 * OTP kodni email orqali yuborish uchun "email" queue'ga job qo'shadi.
 * Email to'g'ridan-to'g'ri (sinxron) yuborilmaydi — buning o'rniga worker
 * uni fon rejimida (asinxron) qayta ishlaydi, shu bilan HTTP so'rovi
 * SMTP javobini kutib turmaydi.
 */
export async function queueOtpEmail(to: string, otp: string): Promise<void> {
  await emailQueue.add("send-otp-email", { to, otp });
}

/**
 * "email" queue'dagi job'larni qayta ishlovchi worker. Har bir
 * "send-otp-email" job'i uchun nodemailer orqali email yuboradi.
 */
export const emailWorker = new Worker<SendOtpEmailJobData>(
  QUEUE_NAME,
  async (job: Job<SendOtpEmailJobData>) => {
    const { to, otp } = job.data;

    await transporter.sendMail({
      from: env.SMTP_USER,
      to,
      subject: "AI Creative Hub — Emailni tasdiqlash kodi",
      text: `Tasdiqlash kodingiz: ${otp}\n\nBu kod 10 daqiqa davomida amal qiladi.`,
      html: `<p>Tasdiqlash kodingiz: <b>${otp}</b></p><p>Bu kod 10 daqiqa davomida amal qiladi.</p>`,
    });
  },
  { connection }
);

emailWorker.on("completed", (job) => {
  console.log(`✅ Email queue: job #${job.id} muvaffaqiyatli yuborildi (${job.data.to})`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Email queue: job #${job?.id} muvaffaqiyatsiz tugadi:`, err.message);
});
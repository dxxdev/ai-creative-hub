import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const QUEUE_NAME = "email";

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface SendOtpEmailJobData {
  to: string;
  otp: string;
}

export interface SendPasswordResetEmailJobData {
  to: string;
  resetLink: string;
}

// Ikkala job turini birlashtirgan umumiy tip
type EmailJobData =
  | ({ type: "send-otp-email" } & SendOtpEmailJobData)
  | ({ type: "send-password-reset-email" } & SendPasswordResetEmailJobData);

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export async function queueOtpEmail(to: string, otp: string): Promise<void> {
  await emailQueue.add("send-otp-email", { type: "send-otp-email", to, otp });
}

export async function queuePasswordResetEmail(
  to: string,
  resetLink: string
): Promise<void> {
  await emailQueue.add("send-password-reset-email", {
    type: "send-password-reset-email",
    to,
    resetLink,
  });
}

export const emailWorker = new Worker<EmailJobData>(
  QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    if (job.data.type === "send-otp-email") {
      const { to, otp } = job.data;
      await transporter.sendMail({
        from: env.SMTP_USER,
        to,
        subject: "AI Creative Hub — Emailni tasdiqlash kodi",
        text: `Tasdiqlash kodingiz: ${otp}\n\nBu kod 10 daqiqa davomida amal qiladi.`,
        html: `<p>Tasdiqlash kodingiz: <b>${otp}</b></p><p>Bu kod 10 daqiqa davomida amal qiladi.</p>`,
      });
      return;
    }

    if (job.data.type === "send-password-reset-email") {
      const { to, resetLink } = job.data;
      await transporter.sendMail({
        from: env.SMTP_USER,
        to,
        subject: "AI Creative Hub — Parolni tiklash",
        text: `Parolni tiklash uchun havola: ${resetLink}\n\nBu havola 30 daqiqa davomida amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.`,
        html: `<p>Parolni tiklash uchun quyidagi havolani bosing:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Bu havola 30 daqiqa davomida amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.</p>`,
      });
      return;
    }
  },
  { connection }
);

emailWorker.on("completed", (job) => {
  console.log(`✅ Email queue: job #${job.id} muvaffaqiyatli yuborildi (${job.data.to})`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Email queue: job #${job?.id} muvaffaqiyatsiz tugadi:`, err.message);
});
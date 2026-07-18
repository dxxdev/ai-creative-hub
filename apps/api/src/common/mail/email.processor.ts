import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { EMAIL_QUEUE, EmailJobData } from "./email-queue.service";
import { MailService } from "./mail.service";

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const data = job.data;

    switch (data.type) {
      case "VERIFY_EMAIL":
        await this.mailService.sendMail({
          to: data.to,
          subject: "AI Creative Hub — Emailingizni tasdiqlang",
          html: `<p>Tasdiqlash kodingiz: <b>${data.otp}</b></p><p>Kod 10 daqiqa amal qiladi.</p>`,
        });
        break;

      case "PASSWORD_RESET":
        await this.mailService.sendMail({
          to: data.to,
          subject: "AI Creative Hub — Parolni tiklash",
          html: `<p>Parolni tiklash uchun havola (1 soat amal qiladi):</p><p><a href="${data.resetUrl}">${data.resetUrl}</a></p>`,
        });
        break;

      case "FORK_NOTIFICATION":
        await this.mailService.sendMail({
          to: data.to,
          subject: "Postingiz fork qilindi",
          html: `<p>@${data.forkedByUsername} sizning "${data.postTitle}" promptingizni fork qildi.</p>`,
        });
        break;

      default:
        this.logger.warn(`Noma'lum email job turi: ${JSON.stringify(data)}`);
    }
  }
}
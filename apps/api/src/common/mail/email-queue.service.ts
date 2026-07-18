import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

export const EMAIL_QUEUE = "email-queue";

export type EmailJobData =
  | { type: "VERIFY_EMAIL"; to: string; otp: string }
  | { type: "PASSWORD_RESET"; to: string; resetUrl: string }
  | { type: "FORK_NOTIFICATION"; to: string; forkedByUsername: string; postTitle: string };

@Injectable()
export class EmailQueueService {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly queue: Queue<EmailJobData>) {}

  async enqueueVerificationEmail(to: string, otp: string) {
    await this.queue.add("send-email", { type: "VERIFY_EMAIL", to, otp }, this.defaultJobOptions());
  }

  async enqueuePasswordResetEmail(to: string, resetUrl: string) {
    await this.queue.add(
      "send-email",
      { type: "PASSWORD_RESET", to, resetUrl },
      this.defaultJobOptions(),
    );
  }

  private defaultJobOptions() {
    return {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 50,
    };
  }
}
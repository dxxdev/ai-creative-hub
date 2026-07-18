import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { EMAIL_QUEUE, EmailQueueService } from "./email-queue.service";
import { EmailProcessor } from "./email.processor";
import { MailService } from "./mail.service";

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [MailService, EmailQueueService, EmailProcessor],
  exports: [MailService, EmailQueueService],
})
export class MailModule {}
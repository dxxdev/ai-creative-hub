import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendMail(input: SendMailInput): Promise<void> {
    const provider = this.config.get<string>("MAIL_PROVIDER", "console");

    switch (provider) {
      case "console":
      default:
        this.logger.log(
          `📧 [DEV MAIL] Kimga: ${input.to} | Mavzu: ${input.subject}\n${input.html}`,
        );
        return;
      // case "resend":
      //   await resendClient.emails.send({ from: FROM, to: input.to, subject: input.subject, html: input.html });
      //   return;
    }
  }
}
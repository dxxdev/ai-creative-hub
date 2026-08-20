
export async function sendVerificationEmail(email: string, otp: string): Promise<void> {
  // TODO: haqiqiy email provayder bilan almashtirish (Resend, Nodemailer, SES va h.k.)
  console.log(`[DEV] ${email} manziliga OTP yuborildi: ${otp}`);
}
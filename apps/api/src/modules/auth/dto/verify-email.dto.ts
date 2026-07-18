import { IsEmail, IsString, Length } from "class-validator";

export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6, { message: "Tasdiqlash kodi 6 xonali bo'lishi kerak." })
  otp!: string;
}
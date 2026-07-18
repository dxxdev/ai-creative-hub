import { IsString, Matches, MaxLength, MinLength } from "class-validator";

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_REGEX, {
    message: "Parolda kamida 1 katta harf, 1 raqam va 1 maxsus belgi (!@#$%^&*) bo'lishi kerak.",
  })
  newPassword!: string;
}
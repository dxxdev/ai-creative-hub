import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

// PRD 1.3.1: kamida 8 belgi, 1 katta harf, 1 raqam, 1 maxsus belgi
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

export class RegisterDto {
  @IsEmail({}, { message: "Email manzili noto'g'ri formatda." })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak." })
  @MaxLength(72) // bcrypt 72 baytdan uzun stringni kesib tashlaydi
  @Matches(PASSWORD_REGEX, {
    message: "Parolda kamida 1 katta harf, 1 raqam va 1 maxsus belgi (!@#$%^&*) bo'lishi kerak.",
  })
  password!: string;
}
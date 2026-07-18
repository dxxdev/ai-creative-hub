import { Matches, MaxLength, MinLength } from "class-validator";

export class SetUsernameDto {
  @MinLength(3, { message: "Username kamida 3 belgidan iborat bo'lishi kerak." })
  @MaxLength(20, { message: "Username 20 belgidan oshmasligi kerak." })
  @Matches(/^[a-z0-9_]+$/, {
    message: "Username faqat kichik lotin harflari, raqam va pastki chiziqdan iborat bo'lishi mumkin.",
  })
  username!: string;
}
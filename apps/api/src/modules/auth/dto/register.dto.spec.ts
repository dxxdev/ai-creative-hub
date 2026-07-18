import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { RegisterDto } from "./register.dto";

describe("RegisterDto", () => {
  it("zaif parolni rad etadi (katta harf, raqam, maxsus belgi yo'q)", async () => {
    const dto = plainToInstance(RegisterDto, { email: "test@example.com", password: "weakpass" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("PRD talablariga mos kuchli parolni qabul qiladi", async () => {
    const dto = plainToInstance(RegisterDto, { email: "test@example.com", password: "Str0ng!Pass" });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("noto'g'ri email formatini rad etadi", async () => {
    const dto = plainToInstance(RegisterDto, { email: "not-an-email", password: "Str0ng!Pass" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });
});
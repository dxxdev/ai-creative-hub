import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Masalan: register, login, OAuth callback, email-verify kabi endpointlarni
 * global JwtAuthGuard'dan chetlab o'tish uchun ishlatiladi:
 *
 *   @Public()
 *   @Post("login")
 *   login() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
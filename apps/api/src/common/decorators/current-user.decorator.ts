import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../types/authenticated-user.interface";

/**
 * Controller'da: `login(@CurrentUser() user: AuthenticatedUser)` shaklida ishlatiladi.
 * JwtStrategy.validate() qaytargan qiymat `request.user`ga passport tomonidan
 * avtomatik joylashtiriladi.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
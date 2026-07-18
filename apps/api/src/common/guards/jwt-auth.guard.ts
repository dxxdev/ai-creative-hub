import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Butun ilova bo'yicha global guard sifatida ro'yxatdan o'tkaziladi (app.module.ts,
 * APP_GUARD orqali) — ya'ni har bir endpoint default holda himoyalangan bo'ladi,
 * faqat @Public() bilan belgilanganlar (register/login/oauth/verify) ochiq qoladi.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { Strategy } from "passport-jwt";
import type { JwtRefreshPayload } from "../types/jwt-payload.interface";

function extractRefreshTokenFromCookie(req: Request): string | null {
  return req?.cookies?.refreshToken ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractRefreshTokenFromCookie,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken = extractRefreshTokenFromCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token topilmadi.");
    }
    // Xom tokenni ham uzatamiz — AuthService uni hash qilib Session jadvali bilan solishtiradi.
    return { userId: payload.sub, sessionId: payload.sessionId, refreshToken };
  }
}
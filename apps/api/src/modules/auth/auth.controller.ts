import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.interface";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import type { GoogleProfilePayload } from "./strategies/google.strategy";

const REFRESH_COOKIE_NAME = "refreshToken";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // -----------------------------------------------------------------------
  // Email/Password
  // -----------------------------------------------------------------------

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.verifyEmail(
      dto.email,
      dto.otp,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user: this.toPublicUser(user) };
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(
      dto.email,
      dto.password,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user: this.toPublicUser(user) };
  }

  // -----------------------------------------------------------------------
  // Google OAuth
  // -----------------------------------------------------------------------

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("oauth/google")
  googleLogin() {
    // Bo'sh: GoogleAuthGuard foydalanuvchini avtomatik Google consent sahifasiga yo'naltiradi.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("oauth/google/callback")
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleProfilePayload;
    const user = await this.authService.validateOrCreateGoogleUser(profile);
    const { accessToken, refreshToken, isFirstLogin } = await this.authService.loginWithGoogle(user);

    this.setRefreshCookie(res, refreshToken);

    const webUrl = this.config.get<string>("WEB_URL", "http://localhost:3000");
    const next = isFirstLogin ? "/onboarding" : "/feed";
    // Access token frontendga URL fragment orqali uzatiladi — server loglarida/proxy'da
    // ko'rinmasligi uchun query emas, "#" fragment ishlatiladi (brauzer serverga yubormaydi).
    // Yagona /oauth/callback sahifasi fragmentni o'qib, keyin `next`ga client-side yo'naltiradi.
    res.redirect(`${webUrl}/oauth/callback#accessToken=${accessToken}&next=${next}`);
  }

  // -----------------------------------------------------------------------
  // Sessiya: refresh / logout / joriy foydalanuvchi
  // -----------------------------------------------------------------------

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { userId, sessionId, refreshToken } = req.user as {
      userId: string;
      sessionId: string;
      refreshToken: string;
    };
    const tokens = await this.authService.refreshTokens(userId, sessionId, refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { sessionId } = req.user as { sessionId: string };
    await this.authService.logout(sessionId);
    res.clearCookie(REFRESH_COOKIE_NAME);
    return { message: "Tizimdan chiqdingiz." };
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    // Global JwtAuthGuard tomonidan himoyalangan — faqat access token to'g'ri bo'lsa yetib keladi.
    return { user };
  }

  // -----------------------------------------------------------------------
  // Parolni tiklash
  // -----------------------------------------------------------------------

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // -----------------------------------------------------------------------
  // Yordamchilar
  // -----------------------------------------------------------------------

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>("NODE_ENV") === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 kun — JWT_REFRESH_EXPIRES_IN bilan mos
      path: "/api/auth",
    });
  }

  private toPublicUser(user: { id: string; email: string; username: string | null; role: string }) {
    return { id: user.id, email: user.email, username: user.username, role: user.role };
  }
}
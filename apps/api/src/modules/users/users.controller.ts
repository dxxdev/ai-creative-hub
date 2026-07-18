import { Body, ConflictException, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.interface";
import { SetUsernameDto } from "./dto/set-username.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Global JwtAuthGuard ostida — faqat autentifikatsiya qilingan foydalanuvchi kira oladi.
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    const fullUser = await this.usersService.findById(user.id);
    return { user: fullUser };
  }

  /** Onboarding, 1-qadam: OAuth yoki email orqali birinchi marta kirgan foydalanuvchi username tanlaydi. */
  @Patch("me/username")
  async setUsername(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetUsernameDto) {
    const existing = await this.usersService.findByUsername(dto.username);
    if (existing && existing.id !== user.id) {
      throw new ConflictException("Bu username band.");
    }
    const updated = await this.usersService.setUsername(user.id, dto.username);
    return { user: updated };
  }
}
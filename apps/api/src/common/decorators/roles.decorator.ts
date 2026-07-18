import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@ai-creative-hub/database";

export const ROLES_KEY = "roles";

/**
 * PRD 1.2 — Roles & Permissions Matrix'ga muvofiq endpoint darajasida ruxsat berish.
 * Masalan: @Roles(UserRole.ADMIN, UserRole.MODERATOR)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
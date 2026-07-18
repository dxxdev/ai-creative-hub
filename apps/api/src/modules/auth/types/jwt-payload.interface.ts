import { UserRole } from "@ai-creative-hub/database";

export interface JwtAccessPayload {
  sub: string; // userId
  email: string;
  username: string | null;
  role: UserRole;
}

export interface JwtRefreshPayload {
  sub: string; // userId
  sessionId: string;
}
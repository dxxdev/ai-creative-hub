import { UserRole } from "@ai-creative-hub/database";

/** JwtStrategy.validate() natijasi — access token payload'idan olinadi. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string | null;
  role: UserRole;
}
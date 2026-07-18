import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy, VerifyCallback } from "passport-google-oauth20";

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>("GOOGLE_CLIENT_ID") || "dummy-client-id",
      clientSecret:
        config.get<string>("GOOGLE_CLIENT_SECRET") || "dummy-client-secret",
      callbackURL:
        config.get<string>("GOOGLE_CALLBACK_URL") ||
        "http://localhost:4000/api/auth/oauth/google/callback",
      scope: ["email", "profile"],
    });
  }

  // PRD 1.3.2, band 2-3: Google callback'dan email va profil ma'lumotini oladi.
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    const emailVerified = profile.emails?.[0]?.verified === true;

    if (!email) {
      return done(new Error("Google akkauntida email topilmadi."), undefined);
    }

    const user: GoogleProfilePayload = {
      googleId: profile.id,
      email,
      emailVerified,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };

    done(null, user);
  }
}

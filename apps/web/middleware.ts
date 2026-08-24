import { NextRequest, NextResponse } from "next/server";
import { SESSION_FLAG_COOKIE_NAME } from "./lib/session-cookie";

const SESSION_COOKIE_NAME = SESSION_FLAG_COOKIE_NAME;

const PROTECTED_ROUTES = ["/feed"];
const AUTH_ONLY_ROUTES = ["/login", "/register"];

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value === "1";

  if (matchesRoute(pathname, PROTECTED_ROUTES) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (matchesRoute(pathname, AUTH_ONLY_ROUTES) && hasSession) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/feed/:path*", "/login", "/register"],
};
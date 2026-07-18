import { PrismaClient } from "@prisma/client";

// Next.js/NestJS dev-rejimida hot-reload paytida ko'plab PrismaClient
// instansiyasi yaratilib ketmasligi uchun global singleton pattern.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export * from "@prisma/client";
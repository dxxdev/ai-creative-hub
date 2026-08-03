import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

const SALT_ROUNDS = 12;

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("Bu email allaqachon ro'yxatdan o'tgan");
    this.name = "EmailAlreadyExistsError";
  }
}

function generateUsernameFromEmail(email: string): string {
  const base =
    email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}_${suffix}`;
}

async function findAvailableUsername(email: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateUsernameFromEmail(email);
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }
  return `${generateUsernameFromEmail(email)}_${Date.now()}`;
}

export interface RegisterUserInput {
  email: string;
  password: string;
}

export async function registerUser(input: RegisterUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new EmailAlreadyExistsError();

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const username = await findAvailableUsername(input.email);

  return prisma.user.create({
    data: { email: input.email, username, passwordHash, status: "PENDING_VERIFICATION" },
  });
}
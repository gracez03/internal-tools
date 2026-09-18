import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not set. Copy .env.example to .env and set a secret.");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    // Public sign-up is disabled; demo accounts are created by prisma/seed.ts.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      // input: false => clients can never set or update their own role.
      role: { type: "string", required: false, defaultValue: "viewer", input: false },
    },
  },
  session: {
    cookieCache: { enabled: false },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;

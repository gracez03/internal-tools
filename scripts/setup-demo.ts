/**
 * Repeatable, non-destructive demo setup:
 *  1. create .env from .env.example if missing (with a random BETTER_AUTH_SECRET)
 *  2. regenerate the Prisma client from the current schema (prisma generate)
 *  3. apply pending migrations (prisma migrate deploy)
 *  4. seed demo accounts + cases (idempotent: existing rows are left alone)
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

if (!existsSync(envPath)) {
  const example = readFileSync(path.join(root, ".env.example"), "utf8");
  const secret = randomBytes(32).toString("base64");
  writeFileSync(
    envPath,
    example.replace(/BETTER_AUTH_SECRET=.*/, `BETTER_AUTH_SECRET="${secret}"`),
  );
  console.log("Created .env with a generated BETTER_AUTH_SECRET");
} else {
  console.log(".env already exists — leaving it untouched");
}

const run = (cmd: string) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
};

run("npx prisma generate");
run("npx prisma migrate deploy");
run("npx prisma db seed");

console.log("\nDemo ready. Run: npm run dev  (then open http://localhost:3000)");

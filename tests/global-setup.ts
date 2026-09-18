import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Builds an isolated SQLite database (prisma/test.db) from the migrations and
 * the demo seed before the test run. Never touches prisma/dev.db.
 */
export default function setup() {
  const root = path.resolve(__dirname, "..");
  const env = {
    ...process.env,
    DATABASE_URL: "file:./test.db",
    BETTER_AUTH_SECRET: "test-only-secret-not-for-production-use-0123456789",
    BETTER_AUTH_URL: "http://localhost:3000",
  };
  execSync("npx prisma migrate reset --force --skip-generate", { cwd: root, env, stdio: "inherit" });
}

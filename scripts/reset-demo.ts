/**
 * DESTRUCTIVE: drops the local SQLite database, re-applies all migrations and
 * re-seeds. All decisions and history made in the demo are lost.
 */
import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(__dirname, "..");
console.log("Resetting demo database (all local data will be deleted)...");
execSync("npx prisma migrate reset --force", { cwd: root, stdio: "inherit" });

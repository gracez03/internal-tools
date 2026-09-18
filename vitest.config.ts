import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      BETTER_AUTH_SECRET: "test-only-secret-not-for-production-use-0123456789",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});

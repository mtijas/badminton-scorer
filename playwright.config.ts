import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: [
    {
      command: "pnpm --filter @badminton-scorer/api dev",
      url: "http://localhost:3000/health",
      reuseExistingServer: true,
      env: {
        WEB_ORIGIN: "http://localhost:5173",
        DATABASE_URL:
          process.env.DATABASE_URL ??
          "postgres://badminton:badminton@localhost:5432/badminton_scorer",
      },
    },
    {
      command: "pnpm --filter @badminton-scorer/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      env: {
        VITE_API_URL: "http://localhost:3000",
      },
    },
  ],
});

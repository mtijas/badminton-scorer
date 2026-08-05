import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      all: true,
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      exclude: [
        "**/dist/**",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "database/**",
        "e2e/**",
        "playwright.config.ts",
        "vitest.config.ts",
      ],
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["src/crypto/e2e/testSetup.ts"],
    include: ["src/**/*.test.ts"],
  },
});

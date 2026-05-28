import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["test/backend/env.setup.ts"],
    fileParallelism: false,
    include: ["test/backend/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage/backend",
      include: ["src/backend/**/*.ts"],
      exclude: ["src/backend/server.ts", "src/backend/types.ts"],
    },
  },
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    globalSetup: "./src/test/global-setup.ts",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    // No file parallelism so DB-backed tests share the same migrated SQLite file.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: [
        "src/server/lib/**",
        "src/server/repositories/**",
        "src/server/services/**",
        "src/client/lib/**",
        "src/shared/**",
      ],
      exclude: [
        "src/server/lib/db.ts",
        "src/server/lib/logger.ts",
        "src/client/components/ui/**",
      ],
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
    },
  },
  resolve: { conditions: ["node"] },
});

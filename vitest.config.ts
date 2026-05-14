import os from "os";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest defaults to ~50% of available CPUs for the forks pool, which on
// a GitHub-hosted 2-core runner collapses to 1 worker → effectively
// serial. Force full utilization: I/O-bound DB/MSW tests parallelize
// even when workers oversubscribe physical cores.
const FORKS = Math.max(2, os.availableParallelism?.() ?? os.cpus().length);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: false,
    globalSetup: "./src/test/global-setup.ts",
    // setup-env.ts MUST come first — it sets DATABASE_URL per-worker
    // before setup.ts's prisma import runs. ES imports hoist within a
    // file, but vitest evaluates setupFiles in order across files.
    setupFiles: ["./src/test/setup-env.ts", "./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    // Forks (not threads) so each worker has its own process and a
    // process-local `process.env.DATABASE_URL`. With threads, env is
    // shared across workers and the per-worker DB scheme breaks.
    pool: "forks",
    maxWorkers: FORKS,
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
      // Two-tier thresholds:
      //   • Repo-wide aggregate gate (top-level keys) — branches at 80%
      //     because client/lib + shared mix in pure-glue modules
      //     (format, query-keys) where extra branch tests buy little.
      //   • Server-side stricter glob gate — the AGGREGATE branch
      //     coverage across each src/server/{lib,repositories,services}
      //     folder must hit ≥85%. Note: vitest's glob keys check the
      //     aggregate over matched files, NOT per-file — a single
      //     under-covered file can pass if siblings compensate. For
      //     true per-file enforcement, set `perFile: true` in coverage
      //     options. Aggregate is sufficient for now: any new server
      //     file at <85% noticeably drags the folder average down.
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
        "src/server/lib/**": { branches: 85 },
        "src/server/repositories/**": { branches: 85 },
        "src/server/services/**": { branches: 85 },
      },
    },
  },
  resolve: { conditions: ["node"], tsconfigPaths: true },
});

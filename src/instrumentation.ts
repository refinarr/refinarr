/**
 * Next.js server-startup hook. Runs once when the Node.js server boots,
 * before any HTTP request is handled — the canonical place to start the
 * search worker so the queue is already draining by the time the user's
 * first page loads.
 *
 * MUST live in src/ (not the repo root). With the app at src/app, Next 16's
 * production/standalone build only detects the instrumentation hook under
 * src/ — a root-level instrumentation.ts compiles in dev (turbopack) but is
 * silently dropped from the standalone build, so register() never runs in the
 * Docker image. That's what kept graceful shutdown (#70) from ever wiring up
 * until the file moved here.
 *
 * The dynamic import is required: instrumentation runs in a bootstrap phase
 * where top-level imports of server-only modules can fail. The `!== "edge"`
 * guard skips the Edge runtime (where Prisma can't connect); Next inlines
 * NEXT_RUNTIME at build time, so the Edge bundle dead-code-eliminates this
 * whole block while the Node build keeps it.
 *
 * `ensureSeeded()` stays callable from createApiHandler as an idempotent
 * fallback — the `seeded` flag short-circuits subsequent calls — but
 * with instrumentation in place it should always run here first.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    const { ensureSeeded } = await import("@/server/lib/bootstrap");
    await ensureSeeded();
    // Stop the workers + exit promptly on SIGTERM/SIGINT so `docker
    // stop`/`restart` doesn't wait the full 10s grace before SIGKILL.
    const { registerShutdownHandlers } = await import("@/server/lib/shutdown");
    registerShutdownHandlers();
  }
}

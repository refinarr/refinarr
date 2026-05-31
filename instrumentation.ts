/**
 * Next.js server-startup hook. Runs once when the Node.js server boots,
 * before any HTTP request is handled — the canonical place to start the
 * search worker so the queue is already draining by the time the user's
 * first page loads.
 *
 * The dynamic import is required: instrumentation runs in a bootstrap
 * phase where top-level imports of server-only modules can fail. The
 * NEXT_RUNTIME guard skips Edge-runtime contexts (where Prisma can't
 * connect) so we only seed + start the worker in Node.js.
 *
 * `ensureSeeded()` stays callable from createApiHandler as an idempotent
 * fallback — the `seeded` flag short-circuits subsequent calls — but
 * with instrumentation in place it should always run here first.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSeeded } = await import("@/server/lib/bootstrap");
    await ensureSeeded();
    // Stop the workers + exit promptly on SIGTERM/SIGINT so `docker
    // stop`/`restart` doesn't wait the full 10s grace before SIGKILL.
    const { registerShutdownHandlers } = await import("@/server/lib/shutdown");
    registerShutdownHandlers();
    // Direct stdout: confirms register() actually ran in the standalone
    // server (seeding alone doesn't prove it — createApiHandler re-seeds as a
    // fallback). If this line is absent from boot logs, the SIGTERM handler
    // was never installed and the signal wiring needs a preload shim instead.
    console.log("[instrumentation] shutdown handlers registered");
  }
}

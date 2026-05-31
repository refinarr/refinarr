/**
 * Next.js server-startup hook. Runs once when the Node.js server boots,
 * before any HTTP request is handled — the canonical place to start the
 * search worker so the queue is already draining by the time the user's
 * first page loads.
 *
 * The dynamic import is required: instrumentation runs in a bootstrap
 * phase where top-level imports of server-only modules can fail. The
 * guard skips Edge-runtime contexts (where Prisma can't connect). It is
 * `!== "edge"`, NOT `=== "nodejs"`: Next only sets NEXT_RUNTIME=nodejs from
 * its CLI bin (`next dev/start/build`), never from the standalone
 * `node server.js` entry the Docker image runs — so `=== "nodejs"` silently
 * skipped this whole block in production, deferring seeding to the API
 * fallback and (worse) never installing the shutdown handlers (#72).
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
    // Direct stdout: confirms this block ran (seeding alone doesn't prove it —
    // createApiHandler re-seeds as a fallback). Pairs with the "[shutdown]"
    // line so `docker logs` shows both that handlers installed at boot and
    // that they fired on stop.
    console.log("[instrumentation] shutdown handlers registered");
  }
}

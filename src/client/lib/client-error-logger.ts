import type { ClientErrorReportDto } from "@/shared/types/api";

const CLIENT_LOG_PATH = "/api/logs/client";

export function reportClientError(details: ClientErrorReportDto): void {
  if (typeof window === "undefined") return;
  // No-op under Vitest: happy-dom aborts fire-and-forget fetches at teardown
  // and emits AbortError outside the promise chain, leaking unhandled
  // rejections. Tests that need to assert calls mock this module directly.
  if (process.env.VITEST) return;

  const body = JSON.stringify({
    message: details.message,
    path: details.path,
    method: details.method,
    status: details.status,
    code: details.code,
    traceId: details.traceId,
    stack: details.stack,
    component: details.component,
  });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(CLIENT_LOG_PATH, blob)) return;
  }

  fetch(CLIENT_LOG_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

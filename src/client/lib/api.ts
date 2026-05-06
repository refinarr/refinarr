import { reportClientError } from "./client-error-logger";
import type { ApiErrorResponse } from "@/shared/types/api";

interface ApiClientErrorOptions {
  status: number;
  message: string;
  code?: string;
  traceId?: string;
  retryAfter?: number;
  path: string;
  method: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly traceId?: string;
  readonly retryAfter?: number;
  readonly path: string;
  readonly method: string;

  constructor(options: ApiClientErrorOptions) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.traceId = options.traceId;
    this.retryAfter = options.retryAfter;
    this.path = options.path;
    this.method = options.method;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  let res: Response;

  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (err) {
    // Network failure — no response, so no traceId. Capture the stack so
    // the AppLog row at least points at the call site instead of just
    // "Failed to fetch /something".
    const message = err instanceof Error ? err.message : "Network error";
    const stack = err instanceof Error ? err.stack : undefined;
    reportClientError({ message, path, method, status: 0, stack });
    throw new ApiClientError({ status: 0, message, path, method });
  }

  const traceId = res.headers.get("X-Trace-Id") ?? undefined;
  if (!res.ok) {
    const body = await parseErrorBody(res);
    const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
    const error = new ApiClientError({
      status: res.status,
      message: body.error,
      code: body.code,
      traceId: body.traceId || traceId,
      retryAfter,
      path,
      method,
    });

    if (res.status >= 500) {
      reportClientError({
        message: error.message,
        path,
        method,
        status: error.status,
        code: error.code,
        traceId: error.traceId,
      });
    }

    throw error;
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid API response";
    const stack = err instanceof Error ? err.stack : undefined;
    reportClientError({ message, path, method, status: res.status, traceId, stack });
    throw new ApiClientError({
      status: res.status,
      message: "Invalid API response",
      traceId,
      path,
      method,
    });
  }
}

async function parseErrorBody(res: Response): Promise<ApiErrorResponse> {
  try {
    const body = (await res.json()) as Partial<ApiErrorResponse>;
    return {
      error:
        typeof body.error === "string" ? body.error : `API error ${res.status}`,
      code: typeof body.code === "string" ? body.code : undefined,
      traceId: typeof body.traceId === "string" ? body.traceId : "",
    };
  } catch {
    return { error: "Unknown error", traceId: "" };
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;

  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, data?: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(path: string, data: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

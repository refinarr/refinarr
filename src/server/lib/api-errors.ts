import type { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { ArrType, Instance } from "@/shared/types/models";

type ApiErrorLogLevel = "warn" | "error";

interface HttpErrorOptions {
  status: number;
  message: string;
  code?: string;
  expose?: boolean;
  headers?: HeadersInit;
  logLevel?: ApiErrorLogLevel;
  context?: Record<string, unknown>;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly expose: boolean;
  readonly headers?: HeadersInit;
  readonly logLevel?: ApiErrorLogLevel;
  readonly context?: Record<string, unknown>;

  constructor(options: HttpErrorOptions) {
    super(options.message);
    this.name = "HttpError";
    this.status = options.status;
    this.code = options.code;
    this.expose = options.expose ?? options.status < 500;
    this.headers = options.headers;
    this.logLevel = options.logLevel;
    this.context = options.context;
  }
}

export function badRequest(message: string, code?: string): HttpError {
  return new HttpError({ status: 400, message, code });
}

export function unauthorized(
  message = "Unauthorized",
  code?: string,
): HttpError {
  return new HttpError({ status: 401, message, code });
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError({ status: 404, message });
}

export function conflict(message: string, code?: string): HttpError {
  return new HttpError({ status: 409, message, code });
}

export function tooManyRequests(
  message: string,
  retryAfterMs?: number,
  code?: string,
): HttpError {
  const headers: Record<string, string> = {};
  if (retryAfterMs !== undefined) {
    headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  }
  return new HttpError({ status: 429, message, headers, code });
}

// 503 for server-side capacity / availability limits. Distinct from
// `tooManyRequests` (429) which is *per-caller* throttling — 503 says
// "server is full", not "you specifically sent too many".
export function serviceUnavailable(
  message: string,
  retryAfterMs?: number,
  code?: string,
): HttpError {
  const headers: Record<string, string> = {};
  if (retryAfterMs !== undefined) {
    headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  }
  return new HttpError({ status: 503, message, headers, code });
}

// 502 for a failed call to an upstream the server depends on (a user's
// Radarr/Sonarr being unreachable or erroring). Distinguishes "your *arr is
// down" from "Refinarr itself broke" (500), which a bare 500 can't.
export function badGateway(message: string, code?: string): HttpError {
  return new HttpError({ status: 502, message, expose: true, code });
}

// 500 helper. Defaults to `expose: false` so a future caller doing
// `throw internal("DB conn failed: " + cause)` can't leak the raw
// message to the client. Pass `{ expose: true }` explicitly when the
// message is intentional user-facing copy (e.g. "API key not
// initialized" — see config/api-key route).
export function internal(
  message = "Internal server error",
  options: {
    context?: Record<string, unknown>;
    expose?: boolean;
    code?: string;
  } = {},
): HttpError {
  return new HttpError({
    status: 500,
    message,
    code: options.code,
    expose: options.expose ?? false,
    logLevel: "error",
    context: options.context,
  });
}

export async function parseJson<T>(
  req: NextRequest,
  schema: ZodType<T>,
  invalidMessage: string,
): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Invalid JSON");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ZodPayloadError(invalidMessage, parsed.error);
  }
  return parsed.data;
}

export function positiveInt(
  value: string | undefined,
  name: string,
  max?: number,
): number {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw badRequest(`Invalid ${name}`);
  }
  if (max !== undefined && numericValue > max) {
    throw badRequest(`${name} exceeds maximum of ${max}`);
  }
  return numericValue;
}

// Assertion predicate for route handlers that take a user-supplied
// `instanceId` and need the resolved instance to be a specific arr type
// (e.g. `/api/radarr/*` routes require a radarr instance). Throws
// `badRequest` so a sonarr id sent to a radarr route surfaces as a 400,
// not a cryptic 500 at the first upstream call.
//
// Lives in api-errors.ts (not composition.ts) so the arr composition
// root stays HTTP-free — HTTP status / 4xx semantics belong at the
// API tier alongside the other route guards (parseJson, positiveInt).
//
// `asserts instance is Instance & { type: T }` narrows TS in the
// caller after the call, so a subsequent `createTypedClient(instance,
// "radarr")` is sound without any local cast.
export function assertArrType<T extends ArrType>(
  instance: Instance,
  expectedType: T,
): asserts instance is Instance & { type: T } {
  if (instance.type !== expectedType) {
    throw badRequest(
      `Instance ${instance.id} is type ${instance.type}, expected ${expectedType}`,
      "ARR_TYPE_MISMATCH",
    );
  }
}

export class ZodPayloadError extends Error {
  readonly cause: ZodError;

  constructor(message: string, cause: ZodError) {
    super(message);
    this.name = "ZodPayloadError";
    this.cause = cause;
  }
}

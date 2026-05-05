import type { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

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

export function unauthorized(message = "Unauthorized", code?: string): HttpError {
  return new HttpError({ status: 401, message, code });
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError({ status: 404, message });
}

export function conflict(message: string, code?: string): HttpError {
  return new HttpError({ status: 409, message, code });
}

export function tooManyRequests(message: string, retryAfterMs?: number, code?: string): HttpError {
  const headers: Record<string, string> = {};
  if (retryAfterMs !== undefined) {
    headers["Retry-After"] = String(Math.ceil(retryAfterMs / 1000));
  }
  return new HttpError({ status: 429, message, headers, code });
}

export function internal(
  message = "Internal server error",
  context?: Record<string, unknown>
): HttpError {
  return new HttpError({
    status: 500,
    message,
    expose: true,
    logLevel: "error",
    context,
  });
}

export async function parseJson<T>(
  req: NextRequest,
  schema: ZodType<T>,
  invalidMessage: string
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

export function positiveInt(value: string | undefined, name: string): number {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw badRequest(`Invalid ${name}`);
  }
  return numericValue;
}

export class ZodPayloadError extends Error {
  readonly cause: ZodError;

  constructor(message: string, cause: ZodError) {
    super(message);
    this.name = "ZodPayloadError";
    this.cause = cause;
  }
}

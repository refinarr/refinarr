import type { Instance } from "@/shared/types/models";
import { appLogger } from "@/server/lib/app-logger";
import { assertSafeArrUrl } from "@/server/lib/url-guard";
import { redactString } from "@/server/lib/redact";

// Node's fetch wraps the underlying network error and surfaces a generic
// "fetch failed" message. The real diagnostic (ECONNREFUSED / ENOTFOUND /
// ETIMEDOUT / TLS errors) is on `error.cause`. Pull it forward so the user
// sees something actionable in the log context.
function describeFetchError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: string }).code;
    return code ? `${cause.message} (${code})` : cause.message;
  }
  return e.message;
}

export abstract class ArrClient {
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly instanceName: string;

  constructor(instance: Instance) {
    // Defense in depth: even if a row was tampered with, refuse to fetch
    // unsafe URLs. The primary check happens at write time in InstanceService.
    assertSafeArrUrl(instance.url);
    this.baseUrl = instance.url.replace(/\/$/, "");
    this.apiKey = instance.apiKey;
    this.instanceName = instance.name;
  }

  protected async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v3${path}`;
    const res = await globalThis.fetch(url, {
      ...init,
      headers: {
        "X-Api-Key": this.apiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      appLogger.warn(`Arr API error: ${this.instanceName}`, {
        source: "arr-client",
        context: {
          instance: this.instanceName,
          url,
          status: res.status,
          body: redactString(text).slice(0, 500),
        },
      });
      throw new Error(`${this.instanceName} API error: ${res.status}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    const len = res.headers.get("content-length");
    if (!ct.includes("application/json") || len === "0") return undefined as T;
    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.fetch("/system/status");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: describeFetchError(e) };
    }
  }

  async getCustomFormats(): Promise<Array<{ id: number; name: string }>> {
    return this.fetch<Array<{ id: number; name: string }>>("/customformat");
  }

  abstract getQualityProfiles(): Promise<
    Array<{ id: number; name: string; minUpgradeFormatScore: number }>
  >;
}

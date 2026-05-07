import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";
import { assertSafeArrUrl } from "@/server/lib/url-guard";
import { redactString } from "@/server/lib/redact";
import { arrRateLimiter } from "@/server/lib/ArrRateLimiter";
import type { Instance } from "@/shared/types/models";

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
  protected readonly instanceId: number;

  constructor(instance: Instance) {
    // Defense in depth: even if a row was tampered with, refuse to fetch
    // unsafe URLs. The primary check happens at write time in InstanceService.
    assertSafeArrUrl(instance.url);
    this.baseUrl = instance.url.replace(/\/$/, "");
    this.apiKey = instance.apiKey;
    this.instanceName = instance.name;
    this.instanceId = instance.id;
  }

  protected async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    await arrRateLimiter.acquire(this.instanceId);
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
        source: LogSource.ArrClient,
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

  // Trigger an item-level search. Item is whatever the *arr considers the
  // primary unit — movie / series / album / scene. Each subclass posts the
  // appropriate command to /command. Service action methods can call this
  // through an `ArrClient`-typed reference (no `as RadarrClient` cast).
  abstract triggerSearch(itemId: number): Promise<void>;

  // Delete a file from the *arr's library. Each subclass routes to the
  // right endpoint (Radarr's /moviefile/{id}, Sonarr's /episodefile/{id},
  // etc.). Returns once the upstream confirms the delete; a follow-up
  // search (if requested) is the caller's job.
  abstract deleteFile(fileId: number): Promise<void>;
}

import type { Instance } from "@/shared/types/models";
import { appLogger } from "@/server/lib/app-logger";

export abstract class ArrClient {
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly instanceName: string;

  constructor(instance: Instance) {
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
        context: { instance: this.instanceName, url, status: res.status, body: text.slice(0, 500) },
      });
      throw new Error(`${this.instanceName} API error: ${res.status}`);
    }

    const ct = res.headers.get("content-type") ?? "";
    const len = res.headers.get("content-length");
    if (!ct.includes("application/json") || len === "0") return undefined as T;
    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetch("/system/status");
      return true;
    } catch {
      return false;
    }
  }

  async getCustomFormats(): Promise<Array<{ id: number; name: string }>> {
    return this.fetch<Array<{ id: number; name: string }>>("/customformat");
  }

  abstract getQualityProfiles(): Promise<
    Array<{ id: number; name: string; minUpgradeFormatScore: number }>
  >;
}

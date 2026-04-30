import type { Instance } from "@/shared/types/models";
import { logger } from "@/server/lib/logger";

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
      logger.error({ url, status: res.status, body: text }, "Arr API error");
      throw new Error(`${this.instanceName} API error: ${res.status}`);
    }

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

  abstract getQualityProfiles(): Promise<
    Array<{ id: number; name: string; minUpgradeFormatScore: number }>
  >;
}

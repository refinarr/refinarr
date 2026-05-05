import type { Instance, ArrType, ScoringMode } from "@/shared/types/models";
import { DEFAULT_SCORING_MODE } from "@/shared/scoring-mode";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";
import { assertSafeArrUrl } from "@/server/lib/url-guard";
import { searchWorker } from "@/server/lib/search-worker";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { arrRateLimiter } from "@/server/lib/ArrRateLimiter";
import { eventBus } from "@/server/lib/event-bus";

export class InstanceService {
  async getAll(): Promise<Instance[]> {
    return instanceRepository.findAll();
  }

  async getById(id: number): Promise<Instance | null> {
    return instanceRepository.findById(id);
  }

  async create(data: {
    type: ArrType;
    name: string;
    url: string;
    apiKey: string;
    enabled?: boolean;
    scoringMode?: ScoringMode;
    searchesPerHour?: number;
  }): Promise<Instance> {
    assertSafeArrUrl(data.url);
    const created = await instanceRepository.create({ ...data, enabled: data.enabled ?? true });
    // Start a worker tick for the new instance — bootstrap already ran with
    // the previous (smaller) set of enabled instances, so without this the
    // queue would never drain for instances added after first request.
    void searchWorker.refresh(created.id);
    appLogger.info("Instance created", {
      source: LogSource.InstanceService,
      context: { id: created.id, name: created.name, type: created.type },
    });
    return created;
  }

  async update(id: number, data: Partial<Instance>): Promise<Instance> {
    if (typeof data.url === "string") assertSafeArrUrl(data.url);
    const updated = await instanceRepository.update(id, data);
    // Restart the worker loop for this instance so a new searchesPerHour
    // (or enabled flag) takes effect immediately rather than after restart.
    void searchWorker.refresh(id);
    appLogger.info("Instance updated", {
      source: LogSource.InstanceService,
      context: { id: updated.id, name: updated.name, type: updated.type },
    });
    return updated;
  }

  async delete(id: number): Promise<void> {
    const existing = await instanceRepository.findById(id);
    await searchQueueService.clearPending(id);
    await instanceRepository.delete(id);
    arrRateLimiter.evict(id);
    void searchWorker.refresh(id);
    eventBus.emit({ type: "queue-changed", instanceId: id });
    appLogger.info("Instance deleted", {
      source: LogSource.InstanceService,
      context: { id, name: existing?.name, type: existing?.type },
    });
  }

  async testConnection(id: number): Promise<boolean> {
    const instance = await instanceRepository.findById(id);
    if (!instance) return false;
    const client = ArrClientFactory.createArrClient(instance);
    const result = await client.testConnection();
    const log = result.ok ? appLogger.info : appLogger.error;
    log.call(appLogger, "Connection test", {
      source: LogSource.InstanceService,
      context: {
        id,
        name: instance.name,
        type: instance.type,
        url: instance.url,
        ok: result.ok,
        ...(result.error ? { error: result.error } : {}),
      },
    });
    return result.ok;
  }

  async testCredentials(data: { type: ArrType; url: string; apiKey: string }): Promise<boolean> {
    assertSafeArrUrl(data.url);
    const transient: Instance = {
      id: 0,
      type: data.type,
      name: "(test)",
      url: data.url,
      apiKey: data.apiKey,
      enabled: true,
      scoringMode: DEFAULT_SCORING_MODE,
      searchesPerHour: 20,
      createdAt: new Date(),
    };
    const client = ArrClientFactory.createArrClient(transient);
    const result = await client.testConnection();
    const log = result.ok ? appLogger.info : appLogger.error;
    log.call(appLogger, "Credentials test", {
      source: LogSource.InstanceService,
      context: {
        type: data.type,
        url: data.url,
        ok: result.ok,
        ...(result.error ? { error: result.error } : {}),
      },
    });
    return result.ok;
  }
}

export const instanceService = new InstanceService();

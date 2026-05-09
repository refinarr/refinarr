import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { appLogger } from "@/server/lib/app-logger";
import { assertSafeArrUrl } from "@/server/lib/url-guard";
import { searchWorker } from "@/server/lib/search-worker";
import { statusPoller } from "@/server/lib/status-poller";
import { autoRunner } from "@/server/lib/auto-runner";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { arrRateLimiter } from "@/server/lib/arr-rate-limiter";
import { eventBus } from "@/server/lib/event-bus";
import { LogSource } from "@/shared/types/models";
import { DEFAULT_SCORING_MODE } from "@/shared/scoring-mode";
import type {
  AutoSearchPickStrategy,
  AutoSearchScheduleMode,
  AutoSearchScope,
  AutoSearchScoringMode,
  Instance,
  ArrType,
  ScoringMode,
} from "@/shared/types/models";

export class InstanceService {
  // Catch helper for fire-and-forget worker refreshes. The instance
  // repository / worker rescheduling can throw (DB blip, transient
  // state) and a bare `void worker.refresh(id)` would surface as an
  // unhandled promise rejection, which Node 18+ treats as fatal. We
  // keep the call non-blocking but route any failure into /logs.
  private logRefreshError(worker: string, instanceId: number) {
    return (err: unknown) =>
      appLogger.warn(`${worker}.refresh failed`, {
        source: LogSource.InstanceService,
        err,
        context: { instanceId },
      });
  }

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
    showAllMedia?: boolean;
    autoSearchEnabled?: boolean;
    autoSearchScheduleMode?: AutoSearchScheduleMode;
    autoSearchIntervalMinutes?: number;
    autoSearchCronExpression?: string;
    autoSearchBatchLimit?: number;
    autoSearchLastRunAt?: Date | null;
    autoSearchMonitoredOnly?: boolean;
    autoSearchScope?: AutoSearchScope;
    autoSearchPickStrategy?: AutoSearchPickStrategy;
    autoSearchCooldownHours?: number;
    autoSearchScoringMode?: AutoSearchScoringMode;
  }): Promise<Instance> {
    assertSafeArrUrl(data.url);
    const created = await instanceRepository.create({
      ...data,
      enabled: data.enabled ?? true,
    });
    // Start a worker tick for the new instance — bootstrap already ran with
    // the previous (smaller) set of enabled instances, so without this the
    // queue would never drain for instances added after first request.
    // statusPoller skips its immediate-tick on create: a brand-new instance
    // has no ActionLog rows to update yet, so the upstream fetch would be
    // wasted I/O. The recurring timer still arms normally.
    searchWorker
      .refresh(created.id)
      .catch(this.logRefreshError("searchWorker", created.id));
    statusPoller
      .refresh(created.id, { immediate: false })
      .catch(this.logRefreshError("statusPoller", created.id));
    autoRunner
      .refresh(created.id)
      .catch(this.logRefreshError("autoRunner", created.id));
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
    searchWorker.refresh(id).catch(this.logRefreshError("searchWorker", id));
    statusPoller.refresh(id).catch(this.logRefreshError("statusPoller", id));
    autoRunner.refresh(id).catch(this.logRefreshError("autoRunner", id));
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
    searchWorker.refresh(id).catch(this.logRefreshError("searchWorker", id));
    statusPoller.refresh(id).catch(this.logRefreshError("statusPoller", id));
    autoRunner.refresh(id).catch(this.logRefreshError("autoRunner", id));
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

  async testCredentials(data: {
    type: ArrType;
    url: string;
    apiKey: string;
  }): Promise<boolean> {
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
      showAllMedia: false,
      createdAt: new Date(),
      autoSearchEnabled: false,
      autoSearchScheduleMode: "interval",
      autoSearchIntervalMinutes: 1440,
      autoSearchCronExpression: "0 3 * * *",
      autoSearchBatchLimit: 5,
      autoSearchLastRunAt: null,
      autoSearchMonitoredOnly: true,
      autoSearchScope: "flagged",
      autoSearchPickStrategy: "balanced",
      autoSearchCooldownHours: 0,
      autoSearchPausedUntil: null,
      autoSearchScoringMode: "inherit",
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

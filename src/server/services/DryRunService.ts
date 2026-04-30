import { configRepository } from "@/server/repositories/ConfigRepository";

export class DryRunService {
  async isDryRun(): Promise<boolean> {
    const value = await configRepository.get("dryRun");
    return value === "true";
  }

  async setDryRun(enabled: boolean): Promise<void> {
    await configRepository.set("dryRun", String(enabled));
  }

  async withDryRun<T>(
    isDryRunMode: boolean,
    liveAction: () => Promise<T>,
    dryResult: T
  ): Promise<T> {
    if (isDryRunMode) return dryResult;
    return liveAction();
  }
}

export const dryRunService = new DryRunService();

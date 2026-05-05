import { configRepository } from "@/server/repositories/ConfigRepository";
import { ConfigKey } from "@/server/config/keys";

export class DryRunService {
  async isDryRun(): Promise<boolean> {
    return configRepository.getTyped(ConfigKey.DryRun);
  }

  async setDryRun(enabled: boolean): Promise<void> {
    await configRepository.setTyped(ConfigKey.DryRun, enabled);
  }

  async withDryRun<T>(
    isDryRunMode: boolean,
    liveAction: () => Promise<T>,
    dryResult: T,
  ): Promise<T> {
    if (isDryRunMode) return dryResult;
    return liveAction();
  }
}

export const dryRunService = new DryRunService();

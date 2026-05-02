import type { Instance, ArrType } from "@/shared/types/models";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { appLogger } from "@/server/lib/app-logger";

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
  }): Promise<Instance> {
    const created = await instanceRepository.create({ ...data, enabled: data.enabled ?? true });
    appLogger.info("Instance created", {
      source: "instance-service",
      context: { id: created.id, name: created.name, type: created.type },
    });
    return created;
  }

  async update(id: number, data: Partial<Instance>): Promise<Instance> {
    const updated = await instanceRepository.update(id, data);
    appLogger.info("Instance updated", {
      source: "instance-service",
      context: { id: updated.id, name: updated.name, type: updated.type },
    });
    return updated;
  }

  async delete(id: number): Promise<void> {
    const existing = await instanceRepository.findById(id);
    await instanceRepository.delete(id);
    appLogger.info("Instance deleted", {
      source: "instance-service",
      context: { id, name: existing?.name, type: existing?.type },
    });
  }

  async testConnection(id: number): Promise<boolean> {
    const instance = await instanceRepository.findById(id);
    if (!instance) return false;
    const client = ArrClientFactory.createArrClient(instance);
    const ok = await client.testConnection();
    appLogger.info("Connection test", {
      source: "instance-service",
      context: { id, name: instance.name, type: instance.type, ok },
    });
    return ok;
  }
}

export const instanceService = new InstanceService();

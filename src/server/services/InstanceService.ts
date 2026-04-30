import type { Instance, ArrType } from "@/shared/types/models";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";

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
    return instanceRepository.create({ ...data, enabled: data.enabled ?? true });
  }

  async update(id: number, data: Partial<Instance>): Promise<Instance> {
    return instanceRepository.update(id, data);
  }

  async delete(id: number): Promise<void> {
    return instanceRepository.delete(id);
  }

  async testConnection(id: number): Promise<boolean> {
    const instance = await instanceRepository.findById(id);
    if (!instance) return false;
    const client = ArrClientFactory.createArrClient(instance);
    return client.testConnection();
  }
}

export const instanceService = new InstanceService();

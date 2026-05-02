import { describe, test, expect } from "vitest";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";

describe("PreferenceRepository", () => {
  test("setForInstance inserts the provided CFs", async () => {
    await preferenceRepository.setForInstance(1, [
      { cfId: 10, cfName: "HDR" },
      { cfId: 11, cfName: "Atmos" },
    ]);
    const found = await preferenceRepository.findByInstance(1);
    expect(found).toHaveLength(2);
    expect(found.map((p) => p.cfName).sort()).toEqual(["Atmos", "HDR"]);
  });

  test("setForInstance replaces previous CFs for that instance", async () => {
    await preferenceRepository.setForInstance(1, [{ cfId: 10, cfName: "HDR" }]);
    await preferenceRepository.setForInstance(1, [{ cfId: 20, cfName: "DV" }]);
    const found = await preferenceRepository.findByInstance(1);
    expect(found).toHaveLength(1);
    expect(found[0].cfName).toBe("DV");
  });

  test("setForInstance with [] clears all preferences for the instance", async () => {
    await preferenceRepository.setForInstance(1, [{ cfId: 10, cfName: "HDR" }]);
    await preferenceRepository.setForInstance(1, []);
    expect(await preferenceRepository.findByInstance(1)).toHaveLength(0);
  });

  test("setForInstance is scoped — does not affect other instances", async () => {
    await preferenceRepository.setForInstance(1, [{ cfId: 10, cfName: "HDR" }]);
    await preferenceRepository.setForInstance(2, [{ cfId: 11, cfName: "DV" }]);
    expect(await preferenceRepository.findByInstance(1)).toHaveLength(1);
    expect(await preferenceRepository.findByInstance(2)).toHaveLength(1);
  });

  test("findById returns the row", async () => {
    const created = await preferenceRepository.create({ instanceId: 1, cfId: 5, cfName: "TrueHD" });
    expect(await preferenceRepository.findById(created.id)).not.toBeNull();
  });

  test("findAll lists every row", async () => {
    await preferenceRepository.create({ instanceId: 1, cfId: 5, cfName: "TrueHD" });
    await preferenceRepository.create({ instanceId: 2, cfId: 6, cfName: "DTS-HD" });
    expect(await preferenceRepository.findAll()).toHaveLength(2);
  });

  test("delete removes the row", async () => {
    const created = await preferenceRepository.create({ instanceId: 1, cfId: 5, cfName: "TrueHD" });
    await preferenceRepository.delete(created.id);
    expect(await preferenceRepository.findById(created.id)).toBeNull();
  });

  test("update throws — must go through setForInstance", async () => {
    await expect(preferenceRepository.update(1, {})).rejects.toThrow(/setForInstance/);
  });
});

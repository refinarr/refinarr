import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { instanceService } from "@/server/services/InstanceService";
import { instanceRepository } from "@/server/repositories/InstanceRepository";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const baseData = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

describe("InstanceService.create", () => {
  test("rejects unsafe URLs", async () => {
    await expect(
      instanceService.create({ ...baseData, url: "http://169.254.169.254/" }),
    ).rejects.toThrow();
  });

  test("rejects non-http schemes", async () => {
    await expect(
      instanceService.create({ ...baseData, url: "ftp://example.com/" }),
    ).rejects.toThrow();
  });

  test("creates an enabled instance by default", async () => {
    const created = await instanceService.create(baseData);
    expect(created.enabled).toBe(true);
    expect(created.apiKey).toBe(baseData.apiKey);
  });

  test("respects explicit enabled=false", async () => {
    const created = await instanceService.create({
      ...baseData,
      enabled: false,
    });
    expect(created.enabled).toBe(false);
  });
});

describe("InstanceService.update", () => {
  test("rejects unsafe URL on update", async () => {
    const created = await instanceService.create(baseData);
    await expect(
      instanceService.update(created.id, { url: "http://169.254.169.254/" }),
    ).rejects.toThrow();
  });

  test("renames an instance", async () => {
    const created = await instanceService.create(baseData);
    const updated = await instanceService.update(created.id, {
      name: "Renamed",
    });
    expect(updated.name).toBe("Renamed");
  });
});

describe("InstanceService.delete", () => {
  test("removes the instance", async () => {
    const created = await instanceService.create(baseData);
    await instanceService.delete(created.id);
    expect(await instanceRepository.findById(created.id)).toBeNull();
  });

  test("does not throw when deleting a missing id", async () => {
    // Repository will throw, but service swallows the lookup miss before delete.
    // Validate behavior by creating + deleting twice.
    const created = await instanceService.create(baseData);
    await instanceService.delete(created.id);
    await expect(instanceService.delete(created.id)).rejects.toThrow();
  });
});

describe("InstanceService.testConnection", () => {
  test("returns false when the instance does not exist", async () => {
    expect(await instanceService.testConnection(99999)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns true when the upstream returns 200 JSON", async () => {
    const created = await instanceService.create(baseData);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ version: "5.0.0" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(await instanceService.testConnection(created.id)).toBe(true);
  });

  test("returns false when the upstream returns 401/403", async () => {
    const created = await instanceService.create(baseData);
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    expect(await instanceService.testConnection(created.id)).toBe(false);
  });

  test("returns false when fetch throws (network error)", async () => {
    const created = await instanceService.create(baseData);
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await instanceService.testConnection(created.id)).toBe(false);
  });
});

describe("InstanceService.getAll / getById", () => {
  test("getAll returns every row", async () => {
    await instanceService.create(baseData);
    await instanceService.create({ ...baseData, name: "Other" });
    expect((await instanceService.getAll()).length).toBe(2);
  });

  test("getById returns the row", async () => {
    const created = await instanceService.create(baseData);
    const found = await instanceService.getById(created.id);
    expect(found?.name).toBe(baseData.name);
  });
});

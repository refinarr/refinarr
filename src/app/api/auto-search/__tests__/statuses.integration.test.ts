import { describe, test, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { autoRunner } from "@/server/lib/auto-runner";
import { instanceService } from "@/server/services/InstanceService";
import { GET } from "@/app/api/auto-search/statuses/route";

function req() {
  return new NextRequest("http://localhost/api/auto-search/statuses");
}

const baseInstance = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

describe("GET /api/auto-search/statuses", () => {
  test("returns empty object when no instances have auto-search enabled", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: false,
    });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty(String(inst.id));

    await instanceService.delete(inst.id);
  });

  test("instance-disabled (enabled=false) is excluded even if autoSearchEnabled=true", async () => {
    // Create then disable the instance.
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: true,
    });
    await instanceService.update(inst.id, {
      enabled: false,
    } as Parameters<typeof instanceService.update>[1]);

    const res = await GET(req());
    const body = await res.json();
    expect(body).not.toHaveProperty(String(inst.id));

    await instanceService.delete(inst.id);
  });

  test("auto-search-enabled instance appears in response keyed by its id", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: true,
      autoSearchScheduleMode: "interval" as const,
      autoSearchIntervalMinutes: 60,
    });

    const res = await GET(req());
    const body = await res.json();
    expect(body).toHaveProperty(String(inst.id));

    const status = body[inst.id];
    expect(status.enabled).toBe(true);
    expect(status.scheduleMode).toBe("interval");
    expect(status.intervalMinutes).toBe(60);

    await instanceService.delete(inst.id);
  });

  test("multiple instances: only auto-search-enabled ones appear, keyed by their own ids", async () => {
    const on = await instanceService.create({
      ...baseInstance,
      name: "With auto-search",
      autoSearchEnabled: true,
    });
    const off = await instanceService.create({
      ...baseInstance,
      name: "Without auto-search",
      autoSearchEnabled: false,
    });

    const res = await GET(req());
    const body = await res.json();

    expect(body).toHaveProperty(String(on.id));
    expect(body).not.toHaveProperty(String(off.id));

    // Each entry keyed by its own id, not the other instance's.
    expect(body[on.id]).toBeDefined();
    expect(body[off.id]).toBeUndefined();

    await instanceService.delete(on.id);
    await instanceService.delete(off.id);
  });

  test("pause state is reflected per instance", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: true,
    });
    const pausedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await instanceService.update(inst.id, {
      autoSearchPausedUntil: pausedUntil,
    } as Parameters<typeof instanceService.update>[1]);

    const body = await (await GET(req())).json();
    expect(body[inst.id].paused).toBe(true);
    expect(body[inst.id].pausedUntil).toBe(pausedUntil.toISOString());

    await instanceService.delete(inst.id);
  });

  test("running state comes from autoRunner.isRunning per instance id", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: true,
    });

    vi.spyOn(autoRunner, "isRunning").mockImplementation(
      (id) => id === inst.id,
    );

    const body = await (await GET(req())).json();
    expect(body[inst.id].running).toBe(true);

    vi.restoreAllMocks();
    await instanceService.delete(inst.id);
  });

  test("response shape contains all AutoSearchStatus fields for each entry", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      autoSearchEnabled: true,
      autoSearchScheduleMode: "interval" as const,
      autoSearchIntervalMinutes: 120,
      autoSearchBatchLimit: 3,
      autoSearchCooldownHours: 2,
    });

    const body = await (await GET(req())).json();
    const status = body[inst.id];

    expect(status).toMatchObject({
      enabled: true,
      scheduleMode: "interval",
      intervalMinutes: 120,
      batchLimit: 3,
      cooldownHours: 2,
      running: false,
      paused: false,
      pausedUntil: null,
    });
    // nextRunAt computed — lastRunAt=null means fires immediately (past timestamp).
    expect(new Date(status.nextRunAt).getTime()).toBeLessThan(Date.now());

    await instanceService.delete(inst.id);
  });
});

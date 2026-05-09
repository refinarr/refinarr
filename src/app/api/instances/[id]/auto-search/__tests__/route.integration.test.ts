import { describe, test, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { autoRunner } from "@/server/lib/auto-runner";
import { instanceService } from "@/server/services/InstanceService";
import { GET } from "@/app/api/instances/[id]/auto-search/route";
import { POST as postInstance } from "@/app/api/instances/route";

const ctxFor = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});

function getReq(id: number) {
  return new NextRequest(`http://localhost/api/instances/${id}/auto-search`);
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/instances", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseInstance = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

describe("GET /api/instances/[id]/auto-search", () => {
  // ── 404 / unknown ────────────────────────────────────────────────────────

  test("returns 404 for unknown id", async () => {
    const res = await GET(getReq(99999), ctxFor(99999));
    expect(res.status).toBe(404);
  });

  // ── enabled flag ─────────────────────────────────────────────────────────

  test("autoSearchEnabled=false → enabled=false, nextRunAt=null", async () => {
    const created = await postInstance(
      postReq({ ...baseInstance, autoSearchEnabled: false }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await GET(getReq(id), ctxFor(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.nextRunAt).toBeNull();
    await instanceService.delete(id);
  });

  // ── interval mode ────────────────────────────────────────────────────────

  test("enabled interval mode + lastRunAt=null: nextRunAt is ISO string (epoch + interval)", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScheduleMode: "interval",
        autoSearchIntervalMinutes: 60,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await GET(getReq(id), ctxFor(id));
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.scheduleMode).toBe("interval");
    expect(typeof body.nextRunAt).toBe("string");
    expect(body.nextRunAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await instanceService.delete(id);
  });

  test("interval mode + lastRunAt set: nextRunAt = lastRunAt + intervalMinutes", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScheduleMode: "interval",
        autoSearchIntervalMinutes: 120,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const lastRunAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    await instanceService.update(id, {
      autoSearchLastRunAt: lastRunAt,
    } as Parameters<typeof instanceService.update>[1]);

    const res = await GET(getReq(id), ctxFor(id));
    const body = await res.json();
    const nextRunAt = new Date(body.nextRunAt).getTime();
    const expected = lastRunAt.getTime() + 120 * 60 * 1000;
    expect(Math.abs(nextRunAt - expected)).toBeLessThan(2000);
    await instanceService.delete(id);
  });

  // ── cron mode ────────────────────────────────────────────────────────────

  test("enabled cron mode + valid expression: cronValid=true, nextRunAt is ISO string", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "0 3 * * *",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await GET(getReq(id), ctxFor(id));
    const body = await res.json();
    expect(body.cronValid).toBe(true);
    expect(body.scheduleMode).toBe("cron");
    expect(body.nextRunAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await instanceService.delete(id);
  });

  test("cron mode + invalid expression stored: cronValid=false, nextRunAt=null", async () => {
    const created = await postInstance(postReq(baseInstance), {
      params: Promise.resolve({}),
    });
    const { id } = await created.json();

    await instanceService.update(id, {
      autoSearchEnabled: true,
      autoSearchScheduleMode: "cron",
      autoSearchCronExpression: "garbage",
    } as Parameters<typeof instanceService.update>[1]);

    const res = await GET(getReq(id), ctxFor(id));
    const body = await res.json();
    expect(body.cronValid).toBe(false);
    expect(body.nextRunAt).toBeNull();
    await instanceService.delete(id);
  });

  test("cron mode + 6-field expression: cronValid=false, nextRunAt=null", async () => {
    const created = await postInstance(postReq(baseInstance), {
      params: Promise.resolve({}),
    });
    const { id } = await created.json();

    await instanceService.update(id, {
      autoSearchEnabled: true,
      autoSearchScheduleMode: "cron",
      autoSearchCronExpression: "0 0 3 * * *", // 6 fields — rejected
    } as Parameters<typeof instanceService.update>[1]);

    const res = await GET(getReq(id), ctxFor(id));
    const body = await res.json();
    expect(body.cronValid).toBe(false);
    expect(body.nextRunAt).toBeNull();
    await instanceService.delete(id);
  });

  // ── running state ────────────────────────────────────────────────────────

  test("running=true reflected when autoRunner is processing", async () => {
    const created = await postInstance(
      postReq({ ...baseInstance, autoSearchEnabled: true }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    vi.spyOn(autoRunner, "isRunning").mockReturnValue(true);
    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.running).toBe(true);

    vi.restoreAllMocks();
    await instanceService.delete(id);
  });

  test("running=false when autoRunner is idle", async () => {
    const created = await postInstance(
      postReq({ ...baseInstance, autoSearchEnabled: true }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    vi.spyOn(autoRunner, "isRunning").mockReturnValue(false);
    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.running).toBe(false);

    vi.restoreAllMocks();
    await instanceService.delete(id);
  });

  // ── Response shape ───────────────────────────────────────────────────────

  test("response includes all AutoSearchStatus fields", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScheduleMode: "interval",
        autoSearchIntervalMinutes: 60,
        autoSearchBatchLimit: 5,
        autoSearchMonitoredOnly: true,
        autoSearchScope: "flagged",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const body = await (await GET(getReq(id), ctxFor(id))).json();

    expect(body).toHaveProperty("enabled");
    expect(body).toHaveProperty("scheduleMode");
    expect(body).toHaveProperty("intervalMinutes");
    expect(body).toHaveProperty("cronExpression");
    expect(body).toHaveProperty("cronValid");
    expect(body).toHaveProperty("batchLimit");
    expect(body).toHaveProperty("monitoredOnly");
    expect(body).toHaveProperty("scope");
    expect(body).toHaveProperty("lastRunAt");
    expect(body).toHaveProperty("nextRunAt");
    expect(body).toHaveProperty("running");

    expect(body.scheduleMode).toBe("interval");
    expect(body.intervalMinutes).toBe(60);
    expect(body.batchLimit).toBe(5);
    expect(body.monitoredOnly).toBe(true);
    expect(body.scope).toBe("flagged");
    expect(body.lastRunAt).toBeNull();

    await instanceService.delete(id);
  });

  test("cron mode: cronExpression reflected in response", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScheduleMode: "cron",
        autoSearchCronExpression: "*/30 * * * *",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.scheduleMode).toBe("cron");
    expect(body.cronExpression).toBe("*/30 * * * *");
    await instanceService.delete(id);
  });

  // ── Various scope/batchLimit combinations reflected ──────────────────────

  test("scope=missing reflected in response", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScope: "missing",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();
    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.scope).toBe("missing");
    await instanceService.delete(id);
  });

  test("scope=upgrade reflected in response", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScope: "upgrade",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();
    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.scope).toBe("upgrade");
    await instanceService.delete(id);
  });

  test("scope=all reflected in response", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchScope: "all",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();
    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.scope).toBe("all");
    await instanceService.delete(id);
  });

  test("monitoredOnly=false reflected in response", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchMonitoredOnly: false,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();
    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.monitoredOnly).toBe(false);
    await instanceService.delete(id);
  });

  test("batchLimit=0 reflected in response", async () => {
    const created = await postInstance(
      postReq({
        ...baseInstance,
        autoSearchEnabled: true,
        autoSearchBatchLimit: 0,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();
    const body = await (await GET(getReq(id), ctxFor(id))).json();
    expect(body.batchLimit).toBe(0);
    await instanceService.delete(id);
  });
});

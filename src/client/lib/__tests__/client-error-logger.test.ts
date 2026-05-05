// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { reportClientError } from "@/client/lib/client-error-logger";

const fetchMock = vi.fn();
const sendBeaconMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("VITEST", "");
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: sendBeaconMock,
  });
});

afterEach(() => {
  fetchMock.mockReset();
  sendBeaconMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("reportClientError", () => {
  test("uses sendBeacon when it queues successfully", () => {
    sendBeaconMock.mockReturnValue(true);
    reportClientError({ message: "boom", path: "/dashboard" });
    expect(sendBeaconMock).toHaveBeenCalledWith(
      "/api/logs/client",
      expect.any(Blob),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("falls back to keepalive fetch when sendBeacon returns false", () => {
    sendBeaconMock.mockReturnValue(false);
    reportClientError({ message: "boom", path: "/dashboard" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/logs/client",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });
});

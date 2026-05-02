// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "@/client/lib/api";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api.get", () => {
  test("prefixes path with /api and parses JSON", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const result = await api.get<{ ok: boolean }>("/health");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  test("throws with the server's error message on non-2xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Boom" }, 500));
    await expect(api.get("/x")).rejects.toThrow("Boom");
  });

  test("throws a generic message when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("not-json", { status: 503 }));
    await expect(api.get("/x")).rejects.toThrow("Unknown error");
  });

  test("throws with status code when body has no error field", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ something: "else" }, 418));
    await expect(api.get("/x")).rejects.toThrow(/418/);
  });
});

describe("api.post", () => {
  test("sends a JSON body when data is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }));
    await api.post("/instances", { name: "x" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "x" }));
  });

  test("omits the body when no data argument is provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api.post("/something");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined();
  });
});

describe("api.put / api.delete", () => {
  test("put always sends a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api.put("/instances/1", { name: "y" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify({ name: "y" }));
  });

  test("delete sends a DELETE method with no body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await api.delete("/instances/1");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

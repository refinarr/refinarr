import { describe, it, expect } from "vitest";
import { appendFilterParams } from "../build-query-params";

describe("appendFilterParams", () => {
  it("sets primitive values as strings", () => {
    const params = new URLSearchParams();
    appendFilterParams(params, { sortBy: "score", page: 2, flaggedOnly: true });
    expect(params.get("sortBy")).toBe("score");
    expect(params.get("page")).toBe("2");
    expect(params.get("flaggedOnly")).toBe("true");
  });

  it("skips undefined, null, empty string, and false", () => {
    const params = new URLSearchParams();
    appendFilterParams(params, {
      a: undefined,
      b: null,
      c: "",
      d: false,
      keep: "yes",
    });
    expect(params.has("a")).toBe(false);
    expect(params.has("b")).toBe(false);
    expect(params.has("c")).toBe(false);
    expect(params.has("d")).toBe(false);
    expect(params.get("keep")).toBe("yes");
  });

  it("joins non-empty arrays with commas; skips empty arrays", () => {
    const params = new URLSearchParams();
    appendFilterParams(params, { ids: [1, 2, 3], empty: [] });
    expect(params.get("ids")).toBe("1,2,3");
    expect(params.has("empty")).toBe(false);
  });

  it("does not clear existing params", () => {
    const params = new URLSearchParams({ instanceId: "5" });
    appendFilterParams(params, { sortBy: "title" });
    expect(params.get("instanceId")).toBe("5");
    expect(params.get("sortBy")).toBe("title");
  });
});

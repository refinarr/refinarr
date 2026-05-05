import { describe, test, expect } from "vitest";
import { queryKeys } from "@/client/lib/query-keys";

describe("queryKeys", () => {
  test("flat keys are stable arrays", () => {
    expect(queryKeys.instances()).toEqual(["instances"]);
    expect(queryKeys.config()).toEqual(["config"]);
    expect(queryKeys.health()).toEqual(["health"]);
  });

  test("scoped keys include the id/instanceId", () => {
    expect(queryKeys.instance(7)).toEqual(["instances", 7]);
    expect(queryKeys.preferences(3)).toEqual(["preferences", 3]);
    expect(queryKeys.ignore(5)).toEqual(["ignore", 5]);
    expect(queryKeys.historyErrors(9)).toEqual(["history", "errors", 9]);
  });

  test("media keys preserve the params object", () => {
    const params = { page: 1, sortBy: "score" };
    expect(queryKeys.movies(1, params)).toEqual(["movies", 1, params]);
    expect(queryKeys.series(2, params)).toEqual(["series", 2, params]);
  });

  test("history and appLogs accept undefined params", () => {
    expect(queryKeys.history()).toEqual(["history", undefined]);
    expect(queryKeys.appLogs()).toEqual(["appLogs", undefined]);
  });

  test("typed arr-keys include the type discriminator", () => {
    expect(queryKeys.qualityProfiles("radarr", 1)).toEqual([
      "qualityProfiles",
      "radarr",
      1,
    ]);
    expect(queryKeys.customFormats("sonarr", 2)).toEqual([
      "customFormats",
      "sonarr",
      2,
    ]);
  });
});

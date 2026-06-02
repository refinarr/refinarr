import { describe, test, expect } from "vitest";
import { posterUrl } from "@/client/lib/poster";

describe("posterUrl", () => {
  test("builds the radarr movie poster proxy URL", () => {
    expect(posterUrl("radarr", 3, 42)).toBe(
      "/api/radarr/movies/poster?instanceId=3&mediaId=42",
    );
  });

  test("builds the sonarr series poster proxy URL", () => {
    expect(posterUrl("sonarr", 1, 99)).toBe(
      "/api/sonarr/series/poster?instanceId=1&mediaId=99",
    );
  });
});

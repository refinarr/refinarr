import { describe, test, expect } from "vitest";
import { mediaFocusPath } from "@/client/lib/media-link";

describe("mediaFocusPath", () => {
  test("radarr → /movies with instanceId + mediaId + focus", () => {
    expect(
      mediaFocusPath({ instanceType: "radarr", instanceId: 1, mediaId: 42 }),
    ).toBe("/movies?instanceId=1&mediaId=42&focus=42");
  });

  test("sonarr → /shows with instanceId + mediaId + focus", () => {
    expect(
      mediaFocusPath({ instanceType: "sonarr", instanceId: 2, mediaId: 99 }),
    ).toBe("/shows?instanceId=2&mediaId=99&focus=99");
  });
});

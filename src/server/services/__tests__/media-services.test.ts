import { describe, it, expect } from "vitest";
import { mediaServiceFor } from "@/server/services/media-services";
import { movieService } from "@/server/services/MovieService";
import { seriesService } from "@/server/services/SeriesService";

describe("mediaServiceFor", () => {
  it("dispatches radarr to MovieService", () => {
    expect(mediaServiceFor("radarr")).toBe(movieService);
  });

  it("dispatches sonarr to SeriesService", () => {
    expect(mediaServiceFor("sonarr")).toBe(seriesService);
  });
});

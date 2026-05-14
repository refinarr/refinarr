import { describe, it, expect } from "vitest";
import {
  mediaServiceFor,
  movieService,
  seriesService,
} from "@/server/arr/composition";

describe("mediaServiceFor", () => {
  it("dispatches radarr to MovieService", () => {
    expect(mediaServiceFor("radarr")).toBe(movieService);
  });

  it("dispatches sonarr to SeriesService", () => {
    expect(mediaServiceFor("sonarr")).toBe(seriesService);
  });
});

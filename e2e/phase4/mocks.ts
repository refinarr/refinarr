import type { Page } from "@playwright/test";
import type { PaginatedResponse } from "@/shared/types/api";
import type { MovieItem, SeriesItem } from "@/shared/types/models";

// Reusable API stubs for the Phase 4 UI regression specs. Every page is
// rendered against mocked endpoints (no real *arr), mirroring the pattern
// in mobile.spec.ts / keyboard.spec.ts so the specs stay deterministic.

export const RADARR = {
  id: 1,
  type: "radarr",
  name: "Mock Radarr",
  url: "http://192.168.1.100:7878",
  enabled: true,
  showAllMedia: false,
  createdAt: new Date().toISOString(),
};

export const SONARR = {
  id: 2,
  type: "sonarr",
  name: "Mock Sonarr",
  url: "http://192.168.1.100:8989",
  enabled: true,
  showAllMedia: false,
  createdAt: new Date().toISOString(),
};

export function movie(over: Partial<MovieItem> = {}): MovieItem {
  return {
    id: 1,
    title: "The Missing Format",
    year: 2024,
    qualityProfileId: 1,
    movieFileId: 101,
    customFormats: [],
    customFormatScore: 0,
    hasFile: true,
    cfScore: 0,
    missingFormats: [{ id: 99, name: "HDR" }],
    unwantedFormats: [],
    minProfileScore: 100,
    sizeOnDisk: 5_000_000_000,
    monitored: true,
    existingFileCount: 1,
    totalFileCount: 1,
    flagged: true,
    ...over,
  };
}

export function series(over: Partial<SeriesItem> = {}): SeriesItem {
  return {
    id: 1,
    title: "The Missing Series",
    year: 2024,
    qualityProfileId: 1,
    customFormats: [],
    customFormatScore: 0,
    cfScore: 0,
    missingFormats: [{ id: 99, name: "HDR" }],
    unwantedFormats: [],
    minProfileScore: 100,
    sizeOnDisk: 5_000_000_000,
    monitored: true,
    existingFileCount: 1,
    totalFileCount: 10,
    flagged: true,
    affectedEpisodeCount: 3,
    totalEpisodeCount: 10,
    episodeFiles: [],
    ...over,
  };
}

function page<T>(items: T[]): PaginatedResponse<T> {
  return { items, total: items.length, page: 1, limit: 50, hasMore: false };
}

// The four library densities and the surface (testid) each renders on a
// DESKTOP viewport. On mobile the table densities collapse to the card
// list, so the density loops below run desktop-width.
export const DENSITY_SURFACES: ReadonlyArray<{
  density: string;
  testid: string;
}> = [
  { density: "cozy", testid: "media-table-body" },
  { density: "compact", testid: "media-table-body" },
  { density: "card", testid: "media-card-list" },
  { density: "poster", testid: "media-poster-grid" },
];

// Persist a density and reload so the app reads it on the next paint.
export async function setDensity(pg: Page, density: string): Promise<void> {
  await pg.evaluate((d) => localStorage.setItem("rfn-density", d), density);
  await pg.reload();
}

interface StubOptions {
  movies?: MovieItem[];
  series?: SeriesItem[];
  instances?: unknown[];
}

// Stub the common read endpoints both library pages + the shell need.
export async function stubMediaApis(
  pg: Page,
  { movies = [], series = [], instances = [RADARR, SONARR] }: StubOptions = {},
): Promise<void> {
  await pg.route("**/api/instances**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, json: instances })
      : route.continue(),
  );
  await pg.route("**/api/radarr/movies**", (route) =>
    route.fulfill({ status: 200, json: page(movies) }),
  );
  await pg.route("**/api/sonarr/series**", (route) =>
    route.fulfill({ status: 200, json: page(series) }),
  );
  await pg.route("**/api/radarr/qualityprofiles**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await pg.route("**/api/sonarr/qualityprofiles**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await pg.route("**/api/dashboard/summary**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        totals: { flaggedMovies: 0, flaggedSeries: 0, failedActions24h: 0 },
        perInstance: [],
        recentActivity: [],
      },
    }),
  );
  await pg.route("**/api/history**", (route) =>
    route.fulfill({ status: 200, json: page([]) }),
  );
}

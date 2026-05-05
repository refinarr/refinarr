import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import type { HttpHandler } from "msw";

// Single MSW server shared across the test run. Starts in setup.ts, stops in
// global-setup teardown. Tests append per-request handlers via `mswServer.use(...)`
// and the array is reset between tests.
//
// Default: swallow POSTs to /api/logs/client so the client-error logger's
// fire-and-forget reports during component tests don't trip the
// `onUnhandledRequest: "error"` guard. The reporter itself is also a no-op
// under Vitest, but this is defense-in-depth for tests that mock fetch
// differently.
export const mswServer = setupServer(
  http.post("*/api/logs/client", () => HttpResponse.json({ ok: true })),
);

export { http, HttpResponse };
export type { HttpHandler };

// Tiny helpers for the most common Arr-API mocks.

interface ArrInstance {
  baseUrl: string;
}

export function radarrHandlers(instance: ArrInstance, opts: {
  systemStatus?: { status: number; body?: unknown };
  movies?: unknown[];
  movieFiles?: unknown[];
  qualityProfiles?: unknown[];
  customFormats?: unknown[];
  onCommand?: () => void;
  onDeleteFile?: (fileId: number) => void;
} = {}): HttpHandler[] {
  const base = `${instance.baseUrl.replace(/\/$/, "")}/api/v3`;
  const handlers: HttpHandler[] = [];

  if (opts.systemStatus) {
    handlers.push(http.get(`${base}/system/status`, () =>
      opts.systemStatus!.status === 200
        ? HttpResponse.json(opts.systemStatus!.body ?? { version: "5.0.0" })
        : new HttpResponse(null, { status: opts.systemStatus!.status }),
    ));
  } else {
    handlers.push(http.get(`${base}/system/status`, () => HttpResponse.json({ version: "5.0.0" })));
  }

  if (opts.movies !== undefined) {
    handlers.push(http.get(`${base}/movie`, () => HttpResponse.json(opts.movies)));
  }
  if (opts.movieFiles !== undefined) {
    handlers.push(http.get(`${base}/moviefile`, ({ request }) => {
      const url = new URL(request.url);
      const ids = url.searchParams.getAll("movieFileIds").map(Number);
      const idSet = new Set(ids);
      const filtered = (opts.movieFiles as Array<{ id: number }>).filter((f) => idSet.has(f.id));
      return HttpResponse.json(filtered);
    }));
  }
  if (opts.qualityProfiles !== undefined) {
    handlers.push(http.get(`${base}/qualityprofile`, () => HttpResponse.json(opts.qualityProfiles)));
  }
  if (opts.customFormats !== undefined) {
    handlers.push(http.get(`${base}/customformat`, () => HttpResponse.json(opts.customFormats)));
  }
  handlers.push(http.post(`${base}/command`, async () => {
    opts.onCommand?.();
    return HttpResponse.json({ id: 1 });
  }));
  handlers.push(http.delete(`${base}/moviefile/:fileId`, ({ params }) => {
    opts.onDeleteFile?.(Number(params.fileId));
    return new HttpResponse(null, { status: 200 });
  }));

  return handlers;
}

export function sonarrHandlers(instance: ArrInstance, opts: {
  systemStatus?: { status: number };
  series?: unknown[];
  episodeFilesByseriesId?: Map<number, unknown[]>;
  qualityProfiles?: unknown[];
  customFormats?: unknown[];
  episodes?: unknown[];
  onCommand?: () => void;
  onDeleteEpisodeFile?: (fileId: number) => void;
} = {}): HttpHandler[] {
  const base = `${instance.baseUrl.replace(/\/$/, "")}/api/v3`;
  const handlers: HttpHandler[] = [];

  if (opts.systemStatus) {
    handlers.push(http.get(`${base}/system/status`, () =>
      opts.systemStatus!.status === 200
        ? HttpResponse.json({ version: "4.0.0" })
        : new HttpResponse(null, { status: opts.systemStatus!.status }),
    ));
  } else {
    handlers.push(http.get(`${base}/system/status`, () => HttpResponse.json({ version: "4.0.0" })));
  }

  if (opts.series !== undefined) {
    handlers.push(http.get(`${base}/series`, () => HttpResponse.json(opts.series)));
  }
  if (opts.episodeFilesByseriesId !== undefined) {
    handlers.push(http.get(`${base}/episodefile`, ({ request }) => {
      const url = new URL(request.url);
      const id = Number(url.searchParams.get("seriesId"));
      return HttpResponse.json(opts.episodeFilesByseriesId!.get(id) ?? []);
    }));
  }
  if (opts.qualityProfiles !== undefined) {
    handlers.push(http.get(`${base}/qualityprofile`, () => HttpResponse.json(opts.qualityProfiles)));
  }
  if (opts.customFormats !== undefined) {
    handlers.push(http.get(`${base}/customformat`, () => HttpResponse.json(opts.customFormats)));
  }
  if (opts.episodes !== undefined) {
    handlers.push(http.get(`${base}/episode`, () => HttpResponse.json(opts.episodes)));
  }
  handlers.push(http.post(`${base}/command`, async () => {
    opts.onCommand?.();
    return HttpResponse.json({ id: 1 });
  }));
  handlers.push(http.delete(`${base}/episodefile/:fileId`, ({ params }) => {
    opts.onDeleteEpisodeFile?.(Number(params.fileId));
    return new HttpResponse(null, { status: 200 });
  }));

  return handlers;
}

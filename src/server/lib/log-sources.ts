// Canonical list of components that emit appLogger events. Surfaces to log
// filtering and dashboards, so new sources go here — not as ad-hoc string
// literals at call sites. Keep this list small and discoverable.
export const LogSource = {
  Api: "api",
  Client: "client",
  Auth: "auth",
  Db: "db",
  ArrClient: "arr-client",
  InstanceService: "instance-service",
  MovieService: "movie-service",
  SeriesService: "series-service",
  MediaAction: "media-action",
  SearchQueue: "search-queue",
  SearchWorker: "search-worker",
  StatusPoller: "status-poller",
} as const;

export type LogSource = (typeof LogSource)[keyof typeof LogSource];

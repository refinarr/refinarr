export const queryKeys = {
  instances: () => ["instances"] as const,
  instance: (id: number) => ["instances", id] as const,
  movies: (instanceId: number, params?: object) =>
    ["movies", instanceId, params] as const,
  series: (instanceId: number, params?: object) =>
    ["series", instanceId, params] as const,
  config: () => ["config"] as const,
  preferences: (instanceId: number) => ["preferences", instanceId] as const,
  ignore: (instanceId: number) => ["ignore", instanceId] as const,
  history: (params?: object) => ["history", params] as const,
  historyErrors: (instanceId: number) => ["history", "errors", instanceId] as const,
  qualityProfiles: (type: "radarr" | "sonarr", instanceId: number) =>
    ["qualityProfiles", type, instanceId] as const,
  customFormats: (type: "radarr" | "sonarr", instanceId: number) =>
    ["customFormats", type, instanceId] as const,
  health: () => ["health"] as const,
};

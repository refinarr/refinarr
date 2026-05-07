import { z } from "zod";

export const credentialsSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, numbers, _ . -"),
  password: z.string().min(12).max(256),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});

export const instanceCreateSchema = z.object({
  type: z.enum(["radarr", "sonarr"]),
  name: z.string().min(1).max(64),
  url: z.string().min(1).max(2048),
  apiKey: z.string().min(1).max(256),
  enabled: z.boolean().optional(),
  searchesPerHour: z.number().int().min(1).max(1000).optional(),
});

export const instanceUpdateSchema = z.object({
  type: z.enum(["radarr", "sonarr"]).optional(),
  name: z.string().min(1).max(64).optional(),
  url: z.string().min(1).max(2048).optional(),
  apiKey: z.string().min(1).max(256).optional(),
  enabled: z.boolean().optional(),
  scoringMode: z.enum(["manual", "profile"]).optional(),
  searchesPerHour: z.number().int().min(1).max(1000).optional(),
  showAllMedia: z.boolean().optional(),
});

export const instanceTestSchema = z.object({
  type: z.enum(["radarr", "sonarr"]),
  url: z.string().min(1).max(2048),
  apiKey: z.string().min(1).max(256),
});

export const ignoreCreateSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  mediaType: z.enum(["movie", "series"]),
  title: z.string().min(1).max(512),
});

export const preferencesSchema = z.object({
  instanceId: z.number().int().positive(),
  cfs: z
    .array(
      z.object({
        cfId: z.number().int().nonnegative(),
        cfName: z.string().min(1).max(256),
      }),
    )
    .max(500),
});

export const radarrSearchSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  title: z.string().min(1).max(512),
});

export const radarrDeleteSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  fileId: z.number().int().positive(),
  title: z.string().min(1).max(512),
  search: z.boolean().optional(),
});

export const sonarrSearchSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  title: z.string().min(1).max(512),
});

export const sonarrSeasonSearchSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  seasonNumber: z.number().int().nonnegative(),
  title: z.string().min(1).max(512),
});

export const sonarrEpisodeSearchSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  fileId: z.number().int().positive(),
  title: z.string().min(1).max(512),
});

export const sonarrDeleteSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  fileIds: z.array(z.number().int().positive()).min(1).max(2000),
  title: z.string().min(1).max(512),
  search: z.boolean().optional(),
});

export const configUpdateSchema = z.record(
  z.string().max(128),
  z.string().max(2048),
);

// Common shape required from any ActionLog.payload before retry. The retry
// route validates this much; per-service retryFromPayload then runs its own
// discriminated schema (movieRetryPayloadSchema / seriesRetryPayloadSchema)
// to validate the action-specific fields. passthrough() keeps those extras
// intact for the per-service parse to read.
export const retryPayloadSchema = z.looseObject({
  instanceId: z.number().int().positive(),
  action: z.string().min(1).max(64),
  mediaId: z.number().int().positive(),
  title: z.string().min(1).max(512),
});

const baseRetryFields = {
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  title: z.string().min(1).max(512),
};

// Movies: action="search" stores no extra fields; action="delete" carries
// fileId + optional triggerSearch. The legacy "delete_blacklist" payload
// label is preserved for old rows whose payload was stamped before the
// action column became the canonical record.
export const movieRetryPayloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), ...baseRetryFields }),
  z.object({
    action: z.literal("delete"),
    ...baseRetryFields,
    fileId: z.number().int().positive(),
    triggerSearch: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("delete_blacklist"),
    ...baseRetryFields,
    fileId: z.number().int().positive(),
    triggerSearch: z.boolean().optional(),
  }),
]);

// Series: action="search" is series-level; "search_season" carries
// seasonNumber; "search_episode" carries fileId; "delete" carries fileIds.
export const seriesRetryPayloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("search"), ...baseRetryFields }),
  z.object({
    action: z.literal("search_season"),
    ...baseRetryFields,
    seasonNumber: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal("search_episode"),
    ...baseRetryFields,
    fileId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("delete"),
    ...baseRetryFields,
    fileIds: z.array(z.number().int().positive()).min(1).max(2000),
    triggerSearch: z.boolean().optional(),
  }),
]);

// Re-auth body for /api/config/api-key (read or rotate). Lives next to
// the route's other schemas so the route doesn't define inline zod.
export const apiKeyReauthSchema = z.object({
  password: z.string().min(1).max(256),
});

// Body shape POSTed to /api/logs/client by reportClientError. Caps every
// string field so a misbehaving client can't fill the AppLog table with
// 1MB stack traces.
export const clientErrorReportSchema = z.object({
  message: z.string().min(1).max(2048),
  path: z.string().min(1).max(2048),
  method: z.string().min(1).max(16).optional(),
  status: z.number().int().min(0).max(599).optional(),
  code: z.string().min(1).max(128).optional(),
  traceId: z.string().min(1).max(128).optional(),
  stack: z.string().max(8192).optional(),
  component: z.string().min(1).max(256).optional(),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

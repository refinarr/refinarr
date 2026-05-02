import { z } from "zod";

export const credentialsSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, numbers, _ . -"),
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
});

export const instanceUpdateSchema = z.object({
  type: z.enum(["radarr", "sonarr"]).optional(),
  name: z.string().min(1).max(64).optional(),
  url: z.string().min(1).max(2048).optional(),
  apiKey: z.string().min(1).max(256).optional(),
  enabled: z.boolean().optional(),
});

export const ignoreCreateSchema = z.object({
  instanceId: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  mediaType: z.enum(["movie", "series"]),
  title: z.string().min(1).max(512),
});

export const preferencesSchema = z.object({
  instanceId: z.number().int().positive(),
  cfs: z.array(z.object({
    cfId: z.number().int().nonnegative(),
    cfName: z.string().min(1).max(256),
  })).max(500),
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

export const configUpdateSchema = z.record(z.string().max(128), z.string().max(2048));

export type CredentialsInput = z.infer<typeof credentialsSchema>;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface CreateInstanceDto {
  type: "radarr" | "sonarr";
  name: string;
  url: string;
  apiKey: string;
  enabled?: boolean;
}

export type UpdateInstanceDto = Partial<CreateInstanceDto>;

export interface SetConfigDto {
  key: string;
  value: string;
}

export interface SetPreferencesDto {
  instanceId: number;
  cfs: Array<{ cfId: number; cfName: string }>;
}

export interface BulkActionDto {
  instanceId: number;
  mediaIds: number[];
  action: "search" | "delete" | "ignore";
}

export interface HistoryQuery {
  instanceId?: number;
  status?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export interface MediaQuery {
  instanceId: number;
  page?: number;
  limit?: number;
  sortBy?: "score" | "title" | "added";
  order?: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number;
  missingCfId?: number;
}

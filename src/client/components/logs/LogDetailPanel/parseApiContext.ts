export interface ApiContext {
  method?: string;
  path?: string;
  status?: number;
}

export function parseApiContext(ctx: string | null): ApiContext | null {
  if (!ctx) return null;
  try {
    const parsed: unknown = JSON.parse(ctx);
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    const apiCtx: ApiContext = {
      method: typeof p.method === "string" ? p.method : undefined,
      path: typeof p.path === "string" ? p.path : undefined,
      status: typeof p.status === "number" ? p.status : undefined,
    };
    if (apiCtx.method || apiCtx.path || apiCtx.status !== undefined)
      return apiCtx;
    return null;
  } catch {
    return null;
  }
}

export function apiStatusClass(status: number): string {
  if (status >= 500) return "text-critical";
  if (status >= 400) return "text-warning";
  return "text-muted-foreground";
}

// Best-effort redaction of common credential patterns before they hit logs.
// This is defense-in-depth; the real fix is to never log a request body that
// could contain a secret. But when Sonarr/Radarr echoes back errors that
// quote our request, this scrubs the obvious patterns.

type Pattern = { name: string; re: RegExp; fn: (...args: string[]) => string };

const PATTERNS: Pattern[] = [
  // querystring & body forms: apikey=…, api_key=…, apiKey=…
  { name: "apiKey", re: /([?&;\s]?(?:api[_-]?key|apikey)\s*[=:]\s*)([^\s&"'<>]+)/gi, fn: (_, p) => `${p}***` },
  // X-Api-Key: value  /  Authorization: Bearer token  — capture entire rest of value
  { name: "header", re: /((?:x-api-key|authorization)\s*:\s*)(.+)/gi, fn: (_, p) => `${p}***` },
  // 32-character hex tokens (typical Sonarr/Radarr API key shape)
  { name: "hex32", re: /\b[a-f0-9]{32}\b/gi, fn: () => "***" },
];

const RESERVED_KEYS = new Set<string>([
  "password",
  "passwordhash",
  "apikey",
  "api_key",
  "x-api-key",
  "authorization",
  "cookie",
  "set-cookie",
  "session",
  "encryptionkey",
  "encryption_key",
]);

export function redactString(input: string): string {
  let out = input;
  for (const { re, fn } of PATTERNS) {
    out = out.replace(re, fn as Parameters<string["replace"]>[1]);
  }
  return out;
}

export function redactContext(ctx: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ctx) return ctx;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (RESERVED_KEYS.has(k.toLowerCase())) {
      out[k] = "***";
      continue;
    }
    if (typeof v === "string") {
      out[k] = redactString(v);
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactContext(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

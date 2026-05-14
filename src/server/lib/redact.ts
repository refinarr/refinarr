// Best-effort redaction of common credential patterns before they hit logs.
// This is defense-in-depth; the real fix is to never log a request body that
// could contain a secret. But when Sonarr/Radarr echoes back errors that
// quote our request, this scrubs the obvious patterns.

type Pattern = { name: string; re: RegExp; fn: (...args: string[]) => string };

const PATTERNS: Pattern[] = [
  // querystring & body forms: apikey=…, api_key=…, apiKey=…
  {
    name: "apiKey",
    re: /([?&;\s]?(?:api[_-]?key|apikey)\s*[=:]\s*)([^\s&"'<>]+)/gi,
    fn: (_, p) => `${p}***`,
  },
  // X-Api-Key: value  /  Authorization: Bearer token  — capture entire rest of value
  {
    name: "header",
    re: /((?:x-api-key|authorization)\s*:\s*)(.+)/gi,
    fn: (_, p) => `${p}***`,
  },
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
  "token",
  "bearer",
  "jwt",
  "secret",
  "credentials",
]);

export function redactString(input: string): string {
  let out = input;
  for (const { re, fn } of PATTERNS) {
    out = out.replace(re, fn as Parameters<string["replace"]>[1]);
  }
  return out;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function redactValue(v: unknown): unknown {
  if (typeof v === "string") return redactString(v);
  if (Array.isArray(v)) return v.map(redactValue);
  if (isPlainRecord(v)) return redactContext(v);
  return v;
}

export function redactContext(
  ctx: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!ctx) return ctx;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (RESERVED_KEYS.has(k.toLowerCase())) {
      out[k] = "***";
      continue;
    }
    out[k] = redactValue(v);
  }
  return out;
}

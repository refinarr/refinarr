// SSRF guard for user-supplied *arr instance URLs.
//
// refinarr is an *arr companion: by design users connect it to LAN/loopback
// Sonarr/Radarr instances. We CANNOT blanket-block RFC1918 or 127.0.0.0/8 —
// those are the most common, supported targets. We only reject the
// unambiguously-bad cases: non-http(s) schemes, cloud metadata endpoints,
// IPv6 link-local, and the special 0.0.0.0 host.

const BLOCKED_HOSTS = new Set<string>([
  "169.254.169.254",            // AWS, Azure, GCP, DigitalOcean metadata
  "metadata.google.internal",
  "metadata.googleapis.com",
  "100.100.100.200",            // Alibaba metadata
  "0.0.0.0",
]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function assertSafeArrUrl(input: string): URL {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported protocol "${u.protocol}". Only http(s) is allowed.`);
  }

  // Strip the IPv6 brackets that URL.hostname keeps for [::1] etc.
  const host = u.hostname.startsWith("[") && u.hostname.endsWith("]")
    ? u.hostname.slice(1, -1).toLowerCase()
    : u.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host)) {
    throw new UnsafeUrlError("Blocked host");
  }

  // IPv6 link-local: fe80::/10 — never legitimate for an *arr instance and
  // commonly used in SSRF chains.
  if (host.startsWith("fe80:") || host.startsWith("fe80%")) {
    throw new UnsafeUrlError("Blocked host");
  }

  // Empty host (e.g. file: was filtered above, but defensive).
  if (host.length === 0) {
    throw new UnsafeUrlError("Invalid URL");
  }

  return u;
}

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy is owned by the proxy (see src/proxy.ts) — it's
// the single source of truth and runs on every document/API response.
// Headers below are the ones that should also reach static assets
// (`_next/static/*`, `favicon.ico`) which the proxy matcher skips.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

// Hosts allowed to hit the Next.js dev server (HMR websocket, _next/* assets)
// from a non-localhost origin. Needed when testing on a phone over LAN —
// otherwise Next.js blocks the cross-origin request. Set via env only — the
// repo doesn't ship machine-specific IPs.
const envAllowedDevOrigins =
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];
const allowedDevOrigins =
  isDev && envAllowedDevOrigins.length > 0 ? envAllowedDevOrigins : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow E2E tests to use a separate dist dir so a second `next dev` on a
  // different port doesn't collide with the primary dev server's lock file.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

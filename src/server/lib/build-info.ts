import pkg from "../../../package.json";

// Process-startup-stable values exposed via /api/system. Read once at
// module load so consumers don't pay an import cost per request AND so
// BOOTED_AT_MS is stable across calls (vs `Date.now() -
// process.uptime() * 1000` which drifts by tens of ms per call).
export const APP_VERSION: string = pkg.version;
export const BOOTED_AT_MS: number = Date.now();

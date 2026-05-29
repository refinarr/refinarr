// Single source of truth for the e2e SQLite database path. Imported by
// playwright.config.ts (which exports it as DATABASE_URL for the webServer
// command) and e2e/seed-admin.ts (the preflight seed) so the two can never
// drift onto different files — and seed-admin always targets the e2e DB,
// never an ambient DATABASE_URL that might point at a real database.
export const E2E_DB = "file:./local/e2e-test.db";

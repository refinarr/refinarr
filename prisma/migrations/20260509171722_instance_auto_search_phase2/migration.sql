-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Instance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scoringMode" TEXT NOT NULL DEFAULT 'profile',
    "searchesPerHour" INTEGER NOT NULL DEFAULT 20,
    "showAllMedia" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoSearchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoSearchScheduleMode" TEXT NOT NULL DEFAULT 'interval',
    "autoSearchIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
    "autoSearchCronExpression" TEXT NOT NULL DEFAULT '0 3 * * *',
    "autoSearchBatchLimit" INTEGER NOT NULL DEFAULT 5,
    "autoSearchLastRunAt" DATETIME,
    "autoSearchMonitoredOnly" BOOLEAN NOT NULL DEFAULT true,
    "autoSearchScope" TEXT NOT NULL DEFAULT 'flagged',
    "autoSearchPickStrategy" TEXT NOT NULL DEFAULT 'balanced',
    "autoSearchCooldownHours" INTEGER NOT NULL DEFAULT 0,
    "autoSearchPausedUntil" DATETIME,
    "autoSearchScoringMode" TEXT NOT NULL DEFAULT 'inherit'
);
INSERT INTO "new_Instance" ("apiKey", "autoSearchBatchLimit", "autoSearchCronExpression", "autoSearchEnabled", "autoSearchIntervalMinutes", "autoSearchLastRunAt", "autoSearchMonitoredOnly", "autoSearchPickStrategy", "autoSearchScheduleMode", "autoSearchScope", "createdAt", "enabled", "id", "name", "scoringMode", "searchesPerHour", "showAllMedia", "type", "url") SELECT "apiKey", "autoSearchBatchLimit", "autoSearchCronExpression", "autoSearchEnabled", "autoSearchIntervalMinutes", "autoSearchLastRunAt", "autoSearchMonitoredOnly", "autoSearchPickStrategy", "autoSearchScheduleMode", "autoSearchScope", "createdAt", "enabled", "id", "name", "scoringMode", "searchesPerHour", "showAllMedia", "type", "url" FROM "Instance";
DROP TABLE "Instance";
ALTER TABLE "new_Instance" RENAME TO "Instance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

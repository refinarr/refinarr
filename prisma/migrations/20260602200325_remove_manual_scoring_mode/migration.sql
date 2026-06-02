/*
  Warnings:

  - You are about to drop the `CfPreference` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `autoSearchScoringMode` on the `Instance` table. All the data in the column will be lost.
  - You are about to drop the column `scoringMode` on the `Instance` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "CfPreference_instanceId_cfId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CfPreference";
PRAGMA foreign_keys=on;

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
    "autoSearchFailedStreak" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Instance" ("apiKey", "autoSearchBatchLimit", "autoSearchCooldownHours", "autoSearchCronExpression", "autoSearchEnabled", "autoSearchFailedStreak", "autoSearchIntervalMinutes", "autoSearchLastRunAt", "autoSearchMonitoredOnly", "autoSearchPausedUntil", "autoSearchPickStrategy", "autoSearchScheduleMode", "autoSearchScope", "createdAt", "enabled", "id", "name", "searchesPerHour", "showAllMedia", "type", "url") SELECT "apiKey", "autoSearchBatchLimit", "autoSearchCooldownHours", "autoSearchCronExpression", "autoSearchEnabled", "autoSearchFailedStreak", "autoSearchIntervalMinutes", "autoSearchLastRunAt", "autoSearchMonitoredOnly", "autoSearchPausedUntil", "autoSearchPickStrategy", "autoSearchScheduleMode", "autoSearchScope", "createdAt", "enabled", "id", "name", "searchesPerHour", "showAllMedia", "type", "url" FROM "Instance";
DROP TABLE "Instance";
ALTER TABLE "new_Instance" RENAME TO "Instance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

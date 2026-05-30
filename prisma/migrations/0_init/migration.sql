-- Consolidated initial migration. Built from
-- prisma migrate diff --from-empty --to-migrations, which preserves
-- the column order produced by the original ALTER TABLE chain.
-- The WHERE-clause partial UNIQUE index on SearchQueue is re-added
-- by hand below — Prisma's diff output strips WHERE clauses.

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isDryRun" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRetriedAt" DATETIME,
    "commandId" INTEGER,
    "groupId" TEXT,
    "completionMessage" TEXT
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AppLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanceId" INTEGER
);

-- CreateTable
CREATE TABLE "CfPreference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "cfId" INTEGER NOT NULL,
    "cfName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "IgnoreEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ignoredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Instance" (
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
    "autoSearchScoringMode" TEXT NOT NULL DEFAULT 'inherit',
    "autoSearchFailedStreak" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SearchQueue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "groupId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "dedupKey" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ActionLog_instanceId_commandId_idx" ON "ActionLog"("instanceId" ASC, "commandId" ASC);

-- CreateIndex
CREATE INDEX "ActionLog_groupId_idx" ON "ActionLog"("groupId" ASC);

-- CreateIndex
CREATE INDEX "ActionLog_instanceId_lastRetriedAt_idx" ON "ActionLog"("instanceId" ASC, "lastRetriedAt" ASC);

-- CreateIndex
CREATE INDEX "ActionLog_lastRetriedAt_idx" ON "ActionLog"("lastRetriedAt" ASC);

-- CreateIndex
CREATE INDEX "AppLog_instanceId_createdAt_idx" ON "AppLog"("instanceId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AppLog_instanceId_idx" ON "AppLog"("instanceId" ASC);

-- CreateIndex
CREATE INDEX "AppLog_createdAt_idx" ON "AppLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AppLog_level_idx" ON "AppLog"("level" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CfPreference_instanceId_cfId_key" ON "CfPreference"("instanceId" ASC, "cfId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "IgnoreEntry_instanceId_mediaId_mediaType_key" ON "IgnoreEntry"("instanceId" ASC, "mediaId" ASC, "mediaType" ASC);

-- CreateIndex

-- CreateIndex
CREATE INDEX "SearchQueue_instanceId_status_createdAt_idx" ON "SearchQueue"("instanceId" ASC, "status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username" ASC);


-- Partial UNIQUE index — pending-dedup. Pending rows can't share
-- the (instanceId, action, mediaId, dedupKey) tuple. Terminal
-- (done/failed) rows are exempt from dedup.
CREATE UNIQUE INDEX "SearchQueue_pending_dedup"
    ON "SearchQueue"("instanceId", "action", "mediaId", "dedupKey")
    WHERE status = 'pending';

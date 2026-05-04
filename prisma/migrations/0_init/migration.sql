-- CreateTable
CREATE TABLE "Instance" (
    "id"             INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type"           TEXT     NOT NULL,
    "name"           TEXT     NOT NULL,
    "url"            TEXT     NOT NULL,
    "apiKey"         TEXT     NOT NULL,
    "enabled"        BOOLEAN  NOT NULL DEFAULT true,
    "scoringMode"    TEXT     NOT NULL DEFAULT 'profile',
    "searchesPerHour" INTEGER NOT NULL DEFAULT 20,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key"   TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "IgnoreEntry" (
    "id"         INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER  NOT NULL,
    "mediaId"    INTEGER  NOT NULL,
    "mediaType"  TEXT     NOT NULL,
    "title"      TEXT     NOT NULL,
    "ignoredAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CfPreference" (
    "id"         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "cfId"       INTEGER NOT NULL,
    "cfName"     TEXT    NOT NULL
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id"         INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER  NOT NULL,
    "action"     TEXT     NOT NULL,
    "mediaId"    INTEGER  NOT NULL,
    "title"      TEXT     NOT NULL,
    "isDryRun"   BOOLEAN  NOT NULL DEFAULT false,
    "status"     TEXT     NOT NULL,
    "error"      TEXT,
    "payload"    TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppLog" (
    "id"        INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level"     TEXT     NOT NULL,
    "message"   TEXT     NOT NULL,
    "source"    TEXT,
    "context"   TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id"           INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username"     TEXT     NOT NULL,
    "passwordHash" TEXT     NOT NULL,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "userId"    INTEGER  NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SearchQueue" (
    "id"           INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId"   INTEGER  NOT NULL,
    "action"       TEXT     NOT NULL,
    "mediaId"      INTEGER  NOT NULL,
    "payload"      TEXT     NOT NULL,
    "title"        TEXT     NOT NULL,
    "status"       TEXT     NOT NULL DEFAULT 'pending',
    "error"        TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt"  DATETIME,
    -- Disambiguators stored as top-level columns so the DB can enforce
    -- uniqueness. Use 0 (not NULL) as sentinel — SQLite treats NULL != NULL
    -- inside unique indexes, so two NULL rows would not conflict.
    "seasonNumber" INTEGER  NOT NULL DEFAULT 0,
    "fileId"       INTEGER  NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "IgnoreEntry_instanceId_mediaId_mediaType_key" ON "IgnoreEntry"("instanceId", "mediaId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "CfPreference_instanceId_cfId_key" ON "CfPreference"("instanceId", "cfId");

-- CreateIndex
CREATE INDEX "AppLog_level_idx" ON "AppLog"("level");

-- CreateIndex
CREATE INDEX "AppLog_createdAt_idx" ON "AppLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "SearchQueue_instanceId_status_createdAt_idx" ON "SearchQueue"("instanceId", "status", "createdAt");

-- Partial unique index: at most one pending row per identity.
-- Prisma cannot emit WHERE-clause indexes, so this is hand-written.
-- Terminal rows (done/failed) fall outside the index scope so re-queuing
-- after completion creates a fresh row as intended.
CREATE UNIQUE INDEX "SearchQueue_pending_dedup"
    ON "SearchQueue"("instanceId", "action", "mediaId", "seasonNumber", "fileId")
    WHERE status = 'pending';

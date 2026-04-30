-- CreateTable
CREATE TABLE "Instance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
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
CREATE TABLE "CfPreference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "cfId" INTEGER NOT NULL,
    "cfName" TEXT NOT NULL
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "IgnoreEntry_instanceId_mediaId_mediaType_key" ON "IgnoreEntry"("instanceId", "mediaId", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "CfPreference_instanceId_cfId_key" ON "CfPreference"("instanceId", "cfId");

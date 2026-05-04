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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "SearchQueue_instanceId_status_createdAt_idx" ON "SearchQueue"("instanceId", "status", "createdAt");

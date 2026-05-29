-- DropIndex
DROP INDEX "ActionLog_commandId_idx";

-- CreateIndex
CREATE INDEX "ActionLog_instanceId_commandId_idx" ON "ActionLog"("instanceId", "commandId");

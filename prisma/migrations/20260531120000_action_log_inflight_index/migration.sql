-- CreateIndex
CREATE INDEX "ActionLog_instanceId_status_createdAt_idx" ON "ActionLog"("instanceId" ASC, "status" ASC, "createdAt" ASC);

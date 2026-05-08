-- AlterTable
ALTER TABLE "ActionLog" ADD COLUMN "commandId" INTEGER;
ALTER TABLE "ActionLog" ADD COLUMN "groupId" TEXT;

-- AlterTable
ALTER TABLE "SearchQueue" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "ActionLog_groupId_idx" ON "ActionLog"("groupId");

-- CreateIndex
CREATE INDEX "ActionLog_commandId_idx" ON "ActionLog"("commandId");

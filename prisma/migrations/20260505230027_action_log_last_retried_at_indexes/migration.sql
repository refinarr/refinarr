-- Indexes for the new lastRetriedAt sort/filter paths. The single-column
-- index covers global recent-activity queries; the composite covers the
-- per-instance filter that History and findFailedByInstance use most.

CREATE INDEX "ActionLog_lastRetriedAt_idx" ON "ActionLog"("lastRetriedAt");
CREATE INDEX "ActionLog_instanceId_lastRetriedAt_idx" ON "ActionLog"("instanceId", "lastRetriedAt");

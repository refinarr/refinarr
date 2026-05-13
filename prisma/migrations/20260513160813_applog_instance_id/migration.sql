-- Phase 3 logs viewer: filter by instanceId without JSON-extract scans.
-- app-logger lifts `context.instanceId` to a column on insert; this
-- backfill picks up rows written before the lift was wired up.
ALTER TABLE "AppLog" ADD COLUMN "instanceId" INTEGER;

CREATE INDEX "AppLog_instanceId_idx" ON "AppLog"("instanceId");
CREATE INDEX "AppLog_instanceId_createdAt_idx" ON "AppLog"("instanceId", "createdAt");

-- LOG_RETENTION_CAP bounds the row count; backfill runs in milliseconds.
-- `json_valid` guards against malformed context strings that shouldn't
-- exist but would crash the migration if they did. The `json_type =
-- 'integer' AND > 0` predicate keeps the backfill aligned with the
-- runtime contract (app-logger only lifts positive integers) so old
-- rows can't carry filter values that new inserts would reject.
UPDATE "AppLog"
SET "instanceId" = CAST(json_extract("context", '$.instanceId') AS INTEGER)
WHERE "context" IS NOT NULL
  AND json_valid("context")
  AND json_type("context", '$.instanceId') = 'integer'
  AND json_extract("context", '$.instanceId') > 0;

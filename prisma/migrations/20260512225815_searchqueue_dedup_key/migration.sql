-- SearchQueue: replace Sonarr-shaped `seasonNumber` + `fileId` columns
-- with a generic `dedupKey` text disambiguator that each per-arr module
-- declares via its `ArrDefinition.dedupKey(action, payload)` function.
--
-- The partial UNIQUE INDEX `SearchQueue_pending_dedup` previously
-- keyed on (instanceId, action, mediaId, seasonNumber, fileId). It
-- now keys on (instanceId, action, mediaId, dedupKey) — Sonarr fills
-- ":3" / ":file:42" for season / episode actions; Radarr fills "".
-- Adding a new arr (Lidarr → ":album:N", Whisparr → ":scene:N", etc.)
-- needs no schema change — the module's own `dedupKey` function
-- supplies the disambiguator and the same index does the dedup.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- 1. Build the new table shape (no seasonNumber / fileId, new dedupKey).
CREATE TABLE "new_SearchQueue" (
    "id"          INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId"  INTEGER  NOT NULL,
    "action"      TEXT     NOT NULL,
    "mediaId"     INTEGER  NOT NULL,
    "payload"     TEXT     NOT NULL,
    "title"       TEXT     NOT NULL,
    "status"      TEXT     NOT NULL DEFAULT 'pending',
    "error"       TEXT,
    "groupId"     TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "dedupKey"    TEXT     NOT NULL DEFAULT ''
);

-- 2. Copy data over, computing dedupKey from the old columns so any
--    in-flight `pending` rows retain their dedup identity through the
--    migration. Terminal rows (done/failed) get the same computation
--    for consistency, even though they're no longer subject to dedup.
INSERT INTO "new_SearchQueue" (
    "id", "instanceId", "action", "mediaId", "payload", "title",
    "status", "error", "groupId", "createdAt", "processedAt", "dedupKey"
)
SELECT
    "id", "instanceId", "action", "mediaId", "payload", "title",
    "status", "error", "groupId", "createdAt", "processedAt",
    CASE
        WHEN "action" = 'season'  THEN ':' || CAST("seasonNumber" AS TEXT)
        WHEN "action" = 'episode' THEN ':file:' || CAST("fileId" AS TEXT)
        ELSE ''
    END AS "dedupKey"
FROM "SearchQueue";

-- 3. Drop the old table (and its old index) and rename the new one.
DROP TABLE "SearchQueue";
ALTER TABLE "new_SearchQueue" RENAME TO "SearchQueue";

-- 4. Recreate the standard pending-scan index.
CREATE INDEX "SearchQueue_instanceId_status_createdAt_idx"
    ON "SearchQueue"("instanceId", "status", "createdAt");

-- 5. Recreate the partial UNIQUE index on the new dedup tuple. Prisma
--    can't express WHERE-clause indexes; keep it hand-written.
CREATE UNIQUE INDEX "SearchQueue_pending_dedup"
    ON "SearchQueue"("instanceId", "action", "mediaId", "dedupKey")
    WHERE status = 'pending';

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

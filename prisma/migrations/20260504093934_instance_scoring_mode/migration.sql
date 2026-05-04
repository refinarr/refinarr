-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Instance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scoringMode" TEXT NOT NULL DEFAULT 'profile',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Instance" ("apiKey", "createdAt", "enabled", "id", "name", "type", "url") SELECT "apiKey", "createdAt", "enabled", "id", "name", "type", "url" FROM "Instance";
DROP TABLE "Instance";
ALTER TABLE "new_Instance" RENAME TO "Instance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Migrate per-instance scoringMode rows out of AppConfig into the new column.
-- Existing AppConfig settings win; instances without an explicit setting keep
-- the column default ('profile').
UPDATE "Instance" SET "scoringMode" = (
    SELECT "value" FROM "AppConfig" WHERE "key" = 'scoringMode:' || "Instance"."id"
)
WHERE EXISTS (
    SELECT 1 FROM "AppConfig" WHERE "key" = 'scoringMode:' || "Instance"."id"
);

-- Drop the now-orphaned config rows.
DELETE FROM "AppConfig" WHERE "key" LIKE 'scoringMode:%';

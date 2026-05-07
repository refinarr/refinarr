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
    "searchesPerHour" INTEGER NOT NULL DEFAULT 20,
    "showAllMedia" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Instance" ("apiKey", "createdAt", "enabled", "id", "name", "scoringMode", "searchesPerHour", "type", "url") SELECT "apiKey", "createdAt", "enabled", "id", "name", "scoringMode", "searchesPerHour", "type", "url" FROM "Instance";
DROP TABLE "Instance";
ALTER TABLE "new_Instance" RENAME TO "Instance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

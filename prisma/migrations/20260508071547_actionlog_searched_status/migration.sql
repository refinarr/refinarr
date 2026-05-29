-- Rename existing search-action ActionLog rows from status='success'
-- to status='searched'. "success" was misleading for search actions:
-- it meant "the search command was queued upstream", not "a release
-- was found and downloaded." The new "searched" status reads
-- accurately and pairs with the grabbed/downloaded lifecycle the
-- statusPoller drives. Non-search actions (delete/ignore) keep
-- 'success' since for them success genuinely means "done".
UPDATE "ActionLog"
SET "status" = 'searched'
WHERE "status" = 'success'
  AND "action" IN ('search', 'search_season', 'search_episode');

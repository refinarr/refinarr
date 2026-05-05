-- Split the overloaded "search" ActionType into three values that
-- discriminate Sonarr's series / season / episode-file scopes.
-- LIKE matches the JSON-serialized field name in payload, which is
-- only ever written by triggerSeasonSearch / triggerEpisodeFileSearch
-- on the action="search" path. Movie-delete payloads also contain
-- "fileId" but their action column is "delete", so the WHERE clause
-- excludes them.

UPDATE "ActionLog"
SET action = 'search_season'
WHERE action = 'search'
  AND payload IS NOT NULL
  AND payload LIKE '%"seasonNumber"%';

UPDATE "ActionLog"
SET action = 'search_episode'
WHERE action = 'search'
  AND payload IS NOT NULL
  AND payload LIKE '%"fileId"%';

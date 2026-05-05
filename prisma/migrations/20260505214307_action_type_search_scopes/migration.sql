-- Split the overloaded "search" ActionType into three values that
-- discriminate Sonarr's series / season / episode-file scopes.
-- json_extract reads the actual JSON key, so a string value like
-- "Episode \"seasonNumber\" trick" inside title can't false-match
-- the way a raw LIKE would.

UPDATE "ActionLog"
SET action = 'search_season'
WHERE action = 'search'
  AND payload IS NOT NULL
  AND json_extract(payload, '$.seasonNumber') IS NOT NULL;

UPDATE "ActionLog"
SET action = 'search_episode'
WHERE action = 'search'
  AND payload IS NOT NULL
  AND json_extract(payload, '$.fileId') IS NOT NULL;

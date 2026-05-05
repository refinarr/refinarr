-- Movie delete rows historically wrote action="delete" to the column
-- but action="delete_blacklist" inside the payload — a legacy mismatch
-- that the new retry guard (payload.action === log.action) now rejects.
-- Normalize the payload so retries pass the parity check.

UPDATE "ActionLog"
SET payload = json_replace(payload, '$.action', 'delete')
WHERE action = 'delete'
  AND payload IS NOT NULL
  AND json_extract(payload, '$.action') = 'delete_blacklist';

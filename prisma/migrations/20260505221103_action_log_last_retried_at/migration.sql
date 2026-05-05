-- Track when an ActionLog row was last retried, separately from the
-- original createdAt. Retried rows update lastRetriedAt instead of
-- bumping createdAt, so the original failure timestamp survives and
-- the UI can render "Failed X · Retried Y".

ALTER TABLE "ActionLog" ADD COLUMN "lastRetriedAt" DATETIME;

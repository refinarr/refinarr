-- sessionRepository.deleteAllForUser and deleteOtherSessionsForUser
-- filter sessions by userId. Without an index those deleteMany calls
-- are full-table scans — fine at solo-user scale but linear in the
-- total Session row count on every password rotation prune.
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

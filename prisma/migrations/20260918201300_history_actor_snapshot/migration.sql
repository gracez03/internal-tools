-- Add immutable actor snapshot columns (actorName, actorRole) to case_history.
-- SQLite cannot add NOT NULL columns without a default, so the table is
-- rebuilt. Existing rows are backfilled from the current user row (the best
-- information available); rows written after this migration snapshot the
-- actor at decision time. The append-only triggers are recreated because
-- DROP TABLE removes them.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_case_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "case_history_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "kyc_case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "case_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_case_history" (
    "id", "caseId", "actorId", "actorEmail", "actorName", "actorRole",
    "action", "previousStatus", "newStatus", "reason", "createdAt"
)
SELECT
    h."id", h."caseId", h."actorId", h."actorEmail",
    COALESCE(u."name", ''), COALESCE(u."role", 'viewer'),
    h."action", h."previousStatus", h."newStatus", h."reason", h."createdAt"
FROM "case_history" h
LEFT JOIN "user" u ON u."id" = h."actorId";

DROP TABLE "case_history";
ALTER TABLE "new_case_history" RENAME TO "case_history";
CREATE INDEX "case_history_caseId_idx" ON "case_history"("caseId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- case_history is append-only: reject any UPDATE or DELETE at the database level.
CREATE TRIGGER "case_history_no_update"
BEFORE UPDATE ON "case_history"
BEGIN
  SELECT RAISE(ABORT, 'case_history is append-only: UPDATE is not allowed');
END;

CREATE TRIGGER "case_history_no_delete"
BEFORE DELETE ON "case_history"
BEGIN
  SELECT RAISE(ABORT, 'case_history is append-only: DELETE is not allowed');
END;

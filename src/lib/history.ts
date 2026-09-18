import type { Prisma } from "@prisma/client";
import type { Actor } from "@/lib/session";

/**
 * Shared append-only history writer. Must be called inside the same
 * transaction as the state change it records. There is deliberately no
 * update or delete helper; the DB trigger rejects both anyway.
 */
export type HistoryEntryInput = {
  caseId: string;
  action: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
};

export async function appendHistory(
  tx: Prisma.TransactionClient,
  actor: Actor,
  entry: HistoryEntryInput,
) {
  return tx.caseHistory.create({
    data: {
      caseId: entry.caseId,
      actorId: actor.id,
      actorEmail: actor.email,
      action: entry.action,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      reason: entry.reason,
      // createdAt is the DB default (server clock) — never client supplied.
    },
  });
}

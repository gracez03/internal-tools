import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { appendHistory } from "@/lib/history";
import type { Actor } from "@/lib/session";
import {
  DECISION_TO_STATUS,
  decisionInputSchema,
  type CaseListFilters,
} from "@/modules/kyc/types";

/**
 * Every function here takes the server-derived Actor and performs its own
 * authorization check, so the same rules apply whether the caller is a page,
 * a route handler, or a test.
 */

const STATUS_ORDER: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };

export async function listCases(actor: Actor | null, filters: CaseListFilters) {
  requirePermission(actor, "cases:read");
  const q = filters.q?.trim();
  const cases = await prisma.kycCase.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.risk ? { riskLevel: filters.risk } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { applicantName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { submittedAt: "asc" },
  });
  // Pending work first; SQLite has no CASE ordering through Prisma.
  return cases.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
}

export async function getCaseWithHistory(actor: Actor | null, caseId: string) {
  requirePermission(actor, "cases:read");
  const kycCase = await prisma.kycCase.findUnique({
    where: { id: caseId },
    include: {
      history: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true, email: true, role: true } } },
      },
    },
  });
  if (!kycCase) throw new AppError("not_found", `Case ${caseId} not found`);
  return kycCase;
}

export type CaseWithHistory = Awaited<ReturnType<typeof getCaseWithHistory>>;

/**
 * Decide a pending case. Only pending -> approved/rejected is allowed; anything
 * else is a 409 conflict. The status change and history row are written in one
 * transaction, and the conditional update (`status: "pending"`) guarantees a
 * repeated or stale submission can neither overwrite a completed decision nor
 * add a second history row — even under concurrent requests.
 */
export async function decideCase(actor: Actor | null, caseId: string, rawInput: unknown) {
  const reviewer = requirePermission(actor, "cases:decide");

  const parsed = decisionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError("validation", "Invalid decision", parsed.error.flatten().fieldErrors);
  }
  const { decision, reason } = parsed.data;
  const newStatus = DECISION_TO_STATUS[decision];

  const existing = await prisma.kycCase.findUnique({ where: { id: caseId } });
  if (!existing) throw new AppError("not_found", `Case ${caseId} not found`);
  if (existing.status !== "pending") {
    throw new AppError(
      "conflict",
      `Case ${caseId} is already ${existing.status}; decisions cannot be changed or reopened`,
      { currentStatus: existing.status },
    );
  }

  return prisma.$transaction(async (tx) => {
    const decidedAt = new Date();
    const updated = await tx.kycCase.updateMany({
      where: { id: caseId, status: "pending" },
      data: { status: newStatus, decidedAt },
    });
    if (updated.count !== 1) {
      // Lost a race with another decision; the transaction rolls back.
      throw new AppError("conflict", `Case ${caseId} was decided concurrently`, {
        currentStatus: "unknown",
      });
    }
    const history = await appendHistory(tx, reviewer, {
      caseId,
      action: newStatus,
      previousStatus: "pending",
      newStatus,
      reason,
    });
    const kycCase = await tx.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    return { case: kycCase, history };
  });
}

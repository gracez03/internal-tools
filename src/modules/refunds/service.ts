import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import type { Actor } from "@/lib/session";
import type { RefundListFilters } from "@/modules/refunds/types";

/**
 * Read-only. This module exposes no create/update/delete operations; the
 * only way rows get into refund_request is the seed script.
 */
export async function listRefunds(actor: Actor | null, filters: RefundListFilters) {
  requirePermission(actor, "refunds:read");
  return prisma.refundRequest.findMany({
    where: filters.status ? { status: filters.status } : {},
    orderBy: { requestedAt: "desc" },
  });
}

export type RefundRow = Awaited<ReturnType<typeof listRefunds>>[number];

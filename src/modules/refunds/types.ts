import { z } from "zod";

export const REFUND_STATUSES = ["pending", "approved", "rejected", "processed"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export const refundStatusSchema = z.enum(REFUND_STATUSES);

export const refundListFiltersSchema = z.object({
  status: refundStatusSchema.optional(),
});
export type RefundListFilters = z.infer<typeof refundListFiltersSchema>;

export type RawRefundListFilters = { status?: string };

/** An invalid status is ignored (and reported) rather than failing the request. */
export function parseRefundListFilters(raw: RawRefundListFilters): {
  filters: RefundListFilters;
  invalid: (keyof RefundListFilters)[];
} {
  const filters: RefundListFilters = {};
  const invalid: (keyof RefundListFilters)[] = [];
  const status = refundListFiltersSchema.shape.status.safeParse(raw.status || undefined);
  if (status.success) filters.status = status.data;
  else invalid.push("status");
  return { filters, invalid };
}

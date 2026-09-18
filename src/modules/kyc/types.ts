import { z } from "zod";

export const CASE_STATUSES = ["pending", "approved", "rejected"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const caseStatusSchema = z.enum(CASE_STATUSES);

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const riskLevelSchema = z.enum(RISK_LEVELS);

export const DECISIONS = ["approve", "reject"] as const;
export type Decision = (typeof DECISIONS)[number];

export const REASON_MIN = 3;
export const REASON_MAX = 1000;

/** Body of POST /api/cases/:id/decision. Anything else in the body is ignored. */
export const decisionInputSchema = z.object({
  decision: z.enum(DECISIONS, { error: "decision must be 'approve' or 'reject'" }),
  reason: z
    .string({ error: "reason is required" })
    .trim()
    .min(REASON_MIN, `reason must be at least ${REASON_MIN} characters`)
    .max(REASON_MAX, `reason must be at most ${REASON_MAX} characters`),
});
export type DecisionInput = z.infer<typeof decisionInputSchema>;

export const caseListFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: caseStatusSchema.optional(),
  risk: riskLevelSchema.optional(),
});
export type CaseListFilters = z.infer<typeof caseListFiltersSchema>;

export type RawCaseListFilters = { q?: string; status?: string; risk?: string };

/** Parses each filter independently so one invalid value does not drop the others. */
export function parseCaseListFilters(raw: RawCaseListFilters): {
  filters: CaseListFilters;
  invalid: (keyof CaseListFilters)[];
} {
  const filters: CaseListFilters = {};
  const invalid: (keyof CaseListFilters)[] = [];
  const q = caseListFiltersSchema.shape.q.safeParse(raw.q || undefined);
  if (q.success) filters.q = q.data;
  else invalid.push("q");
  const status = caseListFiltersSchema.shape.status.safeParse(raw.status || undefined);
  if (status.success) filters.status = status.data;
  else invalid.push("status");
  const risk = caseListFiltersSchema.shape.risk.safeParse(raw.risk || undefined);
  if (risk.success) filters.risk = risk.data;
  else invalid.push("risk");
  return { filters, invalid };
}

export const DECISION_TO_STATUS: Record<Decision, CaseStatus> = {
  approve: "approved",
  reject: "rejected",
};

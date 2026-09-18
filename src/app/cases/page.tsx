import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { RiskBadge, StatusBadge } from "@/components/Badge";
import { listCases } from "@/modules/kyc/service";
import { CASE_STATUSES, RISK_LEVELS, parseCaseListFilters } from "@/modules/kyc/types";
import { QueueFilters } from "./QueueFilters";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listCases>>[number];

const columns: Column<Row>[] = [
  { key: "id", header: "Case", render: (r) => <Link href={`/cases/${r.id}`}>{r.id}</Link> },
  { key: "name", header: "Applicant", render: (r) => r.applicantName },
  { key: "email", header: "Email", render: (r) => <span className="muted">{r.email}</span> },
  { key: "submitted", header: "Submitted", render: (r) => r.submittedAt.toISOString().slice(0, 10) },
  { key: "risk", header: "Risk", render: (r) => <RiskBadge risk={r.riskLevel} /> },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const { filters, invalid } = parseCaseListFilters({
    q: first(sp.q),
    status: first(sp.status),
    risk: first(sp.risk),
  });
  const cases = await listCases(actor, filters);
  const pendingCount = cases.filter((c) => c.status === "pending").length;

  return (
    <>
      <AppHeader actor={actor} section="cases" />
      <main className="container">
        <div className="card">
          <h2>KYC review queue</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {cases.length} case{cases.length === 1 ? "" : "s"} shown, {pendingCount} pending.
            {invalid.length > 0 ? ` Ignored invalid ${invalid.join(", ")} filter${invalid.length === 1 ? "" : "s"}.` : ""}
          </p>
          <QueueFilters
            filters={filters}
            statuses={CASE_STATUSES}
            risks={RISK_LEVELS}
          />
        </div>
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            rows={cases}
            rowKey={(r) => r.id}
            emptyMessage="No cases match these filters."
          />
        </div>
      </main>
    </>
  );
}

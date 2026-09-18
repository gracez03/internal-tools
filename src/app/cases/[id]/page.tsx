import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { can } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { AppHeader } from "@/components/AppHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { RiskBadge, StatusBadge } from "@/components/Badge";
import { getCaseWithHistory, type CaseWithHistory } from "@/modules/kyc/service";
import { DecisionForm } from "./DecisionForm";

export const dynamic = "force-dynamic";

type HistoryRow = CaseWithHistory["history"][number];

const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19) + " UTC";

const historyColumns: Column<HistoryRow>[] = [
  { key: "when", header: "When", render: (h) => fmt(h.createdAt) },
  {
    key: "who",
    header: "Who",
    render: (h) => (
      <>
        {h.actor.name} <span className="muted">({h.actorEmail}, {h.actor.role})</span>
      </>
    ),
  },
  {
    key: "change",
    header: "Change",
    render: (h) => (
      <>
        <StatusBadge status={h.previousStatus} /> → <StatusBadge status={h.newStatus} />
      </>
    ),
  },
  { key: "reason", header: "Reason", render: (h) => h.reason },
];

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;

  let kycCase: CaseWithHistory;
  try {
    kycCase = await getCaseWithHistory(actor, id);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const canDecide = can(actor, "cases:decide");

  return (
    <>
      <AppHeader actor={actor} />
      <main className="container">
        <p style={{ marginTop: 0 }}>
          <Link href="/cases">← Back to queue</Link>
        </p>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ marginBottom: 4 }}>
              {kycCase.id} — {kycCase.applicantName}
            </h2>
            <StatusBadge status={kycCase.status} />
          </div>
          <dl className="details" style={{ marginTop: 12 }}>
            <dt>Email</dt>
            <dd>{kycCase.email}</dd>
            <dt>Submitted</dt>
            <dd>{fmt(kycCase.submittedAt)}</dd>
            <dt>Risk level</dt>
            <dd>
              <RiskBadge risk={kycCase.riskLevel} />
            </dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={kycCase.status} />
              {kycCase.decidedAt ? <span className="muted"> — decided {fmt(kycCase.decidedAt)}</span> : null}
            </dd>
            <dt>Review summary</dt>
            <dd>{kycCase.summary}</dd>
          </dl>
        </div>

        <div className="card">
          <h3>Decision</h3>
          {kycCase.status !== "pending" ? (
            <p className="muted" style={{ margin: 0 }}>
              This case is {kycCase.status}. Decisions are final and cannot be reopened.
            </p>
          ) : canDecide ? (
            <DecisionForm caseId={kycCase.id} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Your role ({actor.role}) can view this case but not decide it. Sign in as a reviewer to
              approve or reject.
            </p>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <h3 style={{ padding: "16px 20px 0" }}>History</h3>
          <DataTable
            columns={historyColumns}
            rows={kycCase.history}
            rowKey={(h) => h.id}
            emptyMessage="No decisions recorded yet."
          />
        </div>
      </main>
    </>
  );
}

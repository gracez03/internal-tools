import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/Badge";
import { listRefunds, type RefundRow } from "@/modules/refunds/service";
import { REFUND_STATUSES, parseRefundListFilters } from "@/modules/refunds/types";
import { RefundFilters } from "./RefundFilters";

export const dynamic = "force-dynamic";

/** Display only: the stored value stays an integer number of cents. */
function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
}

const columns: Column<RefundRow>[] = [
  { key: "id", header: "Request", render: (r) => r.id },
  { key: "customer", header: "Customer", render: (r) => r.customerName },
  { key: "email", header: "Email", render: (r) => <span className="muted">{r.email}</span> },
  { key: "amount", header: "Amount", render: (r) => formatAmount(r.amountCents, r.currency) },
  { key: "currency", header: "Currency", render: (r) => r.currency },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "requested", header: "Requested", render: (r) => r.requestedAt.toISOString().slice(0, 10) },
  { key: "reason", header: "Reason", render: (r) => r.reason },
];

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");

  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const { filters, invalid } = parseRefundListFilters({ status: first(sp.status) });
  const refunds = await listRefunds(actor, filters);

  return (
    <>
      <AppHeader actor={actor} section="refunds" />
      <main className="container">
        <div className="card">
          <h2>Refund requests</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Read-only view. {refunds.length} request{refunds.length === 1 ? "" : "s"} shown.
            {invalid.length > 0 ? ` Ignored invalid ${invalid.join(", ")} filter.` : ""}
          </p>
          <RefundFilters filters={filters} statuses={REFUND_STATUSES} />
        </div>
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            rows={refunds}
            rowKey={(r) => r.id}
            emptyMessage="No refund requests match this filter."
          />
        </div>
      </main>
    </>
  );
}

import Link from "next/link";
import type { CaseListFilters } from "@/modules/kyc/types";

export function QueueFilters({
  filters,
  statuses,
  risks,
}: {
  filters: CaseListFilters;
  statuses: readonly string[];
  risks: readonly string[];
}) {
  const hasFilters = Boolean(filters.q || filters.status || filters.risk);
  const formKey = `${filters.q ?? ""}|${filters.status ?? ""}|${filters.risk ?? ""}`;
  return (
    <form key={formKey} className="inline" method="get" action="/cases">
      <label>
        Search
        <input
          type="search"
          name="q"
          placeholder="Case ID, name or email"
          defaultValue={filters.q ?? ""}
        />
      </label>
      <label>
        Status
        <select name="status" defaultValue={filters.status ?? ""}>
          <option value="">All</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        Risk
        <select name="risk" defaultValue={filters.risk ?? ""}>
          <option value="">All</option>
          {risks.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <div className="btn-row">
        <button className="btn btn-primary" type="submit">
          Apply
        </button>
        {hasFilters ? (
          <Link className="btn" href="/cases">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

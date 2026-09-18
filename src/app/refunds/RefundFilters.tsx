import Link from "next/link";
import type { RefundListFilters } from "@/modules/refunds/types";

export function RefundFilters({
  filters,
  statuses,
}: {
  filters: RefundListFilters;
  statuses: readonly string[];
}) {
  return (
    <form key={filters.status ?? ""} className="inline" method="get" action="/refunds">
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
      <div className="btn-row">
        <button className="btn btn-primary" type="submit">
          Apply
        </button>
        {filters.status ? (
          <Link className="btn" href="/refunds">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

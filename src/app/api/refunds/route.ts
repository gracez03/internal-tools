import { errorResponse } from "@/lib/errors";
import { getActorFromRequest } from "@/lib/session";
import { listRefunds } from "@/modules/refunds/service";
import { parseRefundListFilters } from "@/modules/refunds/types";

export async function GET(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    const url = new URL(request.url);
    const { filters, invalid } = parseRefundListFilters({
      status: url.searchParams.get("status") ?? undefined,
    });
    const refunds = await listRefunds(actor, filters);
    return Response.json({ refunds, filters, invalidFilters: invalid });
  } catch (err) {
    return errorResponse(err);
  }
}

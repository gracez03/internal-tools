import { errorResponse } from "@/lib/errors";
import { getActorFromRequest } from "@/lib/session";
import { listCases } from "@/modules/kyc/service";
import { caseListFiltersSchema } from "@/modules/kyc/types";

export async function GET(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    const url = new URL(request.url);
    const parsed = caseListFiltersSchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      risk: url.searchParams.get("risk") ?? undefined,
    });
    const filters = parsed.success ? parsed.data : {};
    const cases = await listCases(actor, filters);
    return Response.json({ cases });
  } catch (err) {
    return errorResponse(err);
  }
}

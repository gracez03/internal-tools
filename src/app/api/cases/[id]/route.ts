import { errorResponse } from "@/lib/errors";
import { getActorFromRequest } from "@/lib/session";
import { getCaseWithHistory } from "@/modules/kyc/service";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActorFromRequest(request);
    const { id } = await ctx.params;
    const kycCase = await getCaseWithHistory(actor, id);
    return Response.json({ case: kycCase });
  } catch (err) {
    return errorResponse(err);
  }
}

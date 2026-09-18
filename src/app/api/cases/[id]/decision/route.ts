import { errorResponse, AppError } from "@/lib/errors";
import { getActorFromRequest } from "@/lib/session";
import { decideCase } from "@/modules/kyc/service";

/**
 * Same-origin check for this state-changing endpoint. Better Auth protects its
 * own routes; this mirrors that for ours. Requests with no Origin header (e.g.
 * server-side tests) are allowed since browsers always send Origin on POST.
 */
function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestHost = request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("forbidden", "Invalid Origin header");
  }
  if (!requestHost || originHost !== requestHost) {
    throw new AppError("forbidden", "Cross-origin request rejected");
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    // Actor and timestamp come from the session and server clock only.
    const actor = await getActorFromRequest(request);
    const { id } = await ctx.params;
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      throw new AppError("validation", "Request body must be JSON");
    }
    const result = await decideCase(actor, id, body);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

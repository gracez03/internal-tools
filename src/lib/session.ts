import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isRole, type Role } from "@/lib/roles";

/**
 * The authenticated actor, derived exclusively from the Better Auth session.
 * Nothing in here comes from the request body or query string.
 */
export type Actor = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

async function actorFromSession(requestHeaders: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { user } = session;
  const role = isRole(user.role) ? user.role : "viewer";
  return { id: user.id, email: user.email, name: user.name, role };
}

/** For route handlers: derive the actor from the incoming Request's cookies. */
export async function getActorFromRequest(request: Request): Promise<Actor | null> {
  return actorFromSession(request.headers);
}

/** For server components / server actions: derive the actor from Next's request headers. */
export async function getActor(): Promise<Actor | null> {
  return actorFromSession(await headers());
}

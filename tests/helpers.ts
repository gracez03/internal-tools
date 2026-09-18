import { auth } from "@/lib/auth";
import { DEMO_ACCOUNTS } from "../prisma/seed-data";

export const VIEWER = DEMO_ACCOUNTS.find((a) => a.role === "viewer")!;
export const REVIEWER = DEMO_ACCOUNTS.find((a) => a.role === "reviewer")!;

const BASE = "http://localhost:3000";

/** Sign in through Better Auth's server API and return the session Cookie header. */
export async function signIn(account: { email: string; password: string }): Promise<string> {
  const { headers } = await auth.api.signInEmail({
    body: { email: account.email, password: account.password },
    returnHeaders: true,
  });
  const setCookie = headers.get("set-cookie");
  if (!setCookie) throw new Error(`No session cookie returned for ${account.email}`);
  // Keep only name=value pairs from possibly multiple Set-Cookie entries.
  return setCookie
    .split(/,(?=\s*[^;,]+=)/)
    .map((c) => c.split(";")[0]!.trim())
    .join("; ");
}

export function jsonRequest(
  path: string,
  init: { method?: string; cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
): Request {
  const headers = new Headers({ host: "localhost:3000", ...init.headers });
  if (init.cookie) headers.set("cookie", init.cookie);
  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
    body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  }
  return new Request(`${BASE}${path}`, { method: init.method ?? "GET", headers, body });
}

export const params = (id: string) => ({ params: Promise.resolve({ id }) });

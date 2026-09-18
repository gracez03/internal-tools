import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/roles";
import type { Actor } from "@/lib/session";

/**
 * Permission names are app-wide; each module maps its operations to one.
 * Roles are only ever read from the server session (see src/lib/session.ts).
 */
export type Permission = "cases:read" | "cases:decide" | "refunds:read";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  viewer: new Set<Permission>(["cases:read", "refunds:read"]),
  reviewer: new Set<Permission>(["cases:read", "cases:decide", "refunds:read"]),
};

export function can(actor: Actor | null, permission: Permission): boolean {
  if (!actor) return false;
  return ROLE_PERMISSIONS[actor.role].has(permission);
}

/** Throws 401 when unauthenticated, 403 when authenticated but lacking the permission. */
export function requirePermission(actor: Actor | null, permission: Permission): Actor {
  if (!actor) throw new AppError("unauthorized", "Authentication required");
  if (!can(actor, permission)) {
    throw new AppError("forbidden", `Your role (${actor.role}) may not perform ${permission}`);
  }
  return actor;
}

import { z } from "zod";

export const ROLES = ["viewer", "reviewer"] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export function isRole(value: unknown): value is Role {
  return roleSchema.safeParse(value).success;
}

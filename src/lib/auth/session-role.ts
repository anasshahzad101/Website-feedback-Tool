import { UserRole } from "@prisma/client";

/** Map session string to enum; unknown/missing values default to REVIEWER (least privilege). */
export function coerceSessionRole(role: string | undefined): UserRole {
  const values = Object.values(UserRole) as string[];
  if (role && values.includes(role)) return role as UserRole;
  return UserRole.REVIEWER;
}

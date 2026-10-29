// ============================================================
// Role hierarchy & permission matrix — single source of truth.
// RED > ADMIN > MANAGER > EMPLOYEE
// The portal is invite-only: there is NO signup route anywhere.
// Accounts are created exclusively through the Team module by
// an authorized role, subject to the rules below.
// ============================================================

export const ROLES = ["RED", "ADMIN", "MANAGER", "EMPLOYEE"] as const
export type Role = (typeof ROLES)[number]

export const ROLE_RANK: Record<Role, number> = {
  RED: 4,
  ADMIN: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
}

export const ROLE_LABEL: Record<Role, string> = {
  RED: "Red",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  RED: "Superior owner — full control, the only role that can assign Admins",
  ADMIN: "Runs the portal, manages Managers and Employees",
  MANAGER: "Operations, approvals and full financial visibility",
  EMPLOYEE: "Self-service — submits and tracks own expenses",
}

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v)
}

/** Module access per role — drives navigation and server guards. */
export type Module =
  | "dashboard"
  | "transactions"
  | "invoices"
  | "expenses"
  | "clients"
  | "reports"
  | "team"
  | "audit"
  | "settings"

const MODULES_BY_ROLE: Record<Role, Module[]> = {
  RED: ["dashboard", "transactions", "invoices", "expenses", "clients", "reports", "team", "audit", "settings"],
  ADMIN: ["dashboard", "transactions", "invoices", "expenses", "clients", "reports", "team", "audit", "settings"],
  MANAGER: ["dashboard", "transactions", "invoices", "expenses", "clients", "reports", "settings"],
  EMPLOYEE: ["dashboard", "expenses", "settings"],
}

export function canAccessModule(role: string, module: Module): boolean {
  if (!isRole(role)) return false
  return MODULES_BY_ROLE[role].includes(module)
}

/** Roles a given actor may assign when creating a user. */
export function assignableRoles(actorRole: Role): Role[] {
  switch (actorRole) {
    case "RED":
      return ["RED", "ADMIN", "MANAGER", "EMPLOYEE"]
    case "ADMIN":
      return ["MANAGER", "EMPLOYEE"]
    default:
      return []
  }
}

/**
 * Role-change legality between two users (excluding identity rules,
 * which are checked separately — nobody edits their own role).
 *  - RED may move anyone to any role.
 *  - ADMIN may only move Managers/Employees between Manager/Employee.
 */
export function canChangeRoleOf(actorRole: Role, targetRole: Role, nextRole: Role): boolean {
  if (actorRole === "RED") return true
  if (actorRole === "ADMIN") {
    return (
      (targetRole === "MANAGER" || targetRole === "EMPLOYEE") &&
      (nextRole === "MANAGER" || nextRole === "EMPLOYEE")
    )
  }
  return false
}

/**
 * Deactivation legality (identity rules checked separately).
 *  - RED may deactivate anyone.
 *  - ADMIN may deactivate only Managers and Employees.
 */
export function canDeactivate(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "RED") return true
  if (actorRole === "ADMIN") return targetRole === "MANAGER" || targetRole === "EMPLOYEE"
  return false
}

/** Financial capabilities used across API routes. */
export function canManageFinance(role: Role): boolean {
  return role === "RED" || role === "ADMIN" || role === "MANAGER"
}

export function canDeleteRecords(role: Role): boolean {
  return role === "RED" || role === "ADMIN"
}

export function canApproveExpenses(role: Role): boolean {
  return role === "RED" || role === "ADMIN" || role === "MANAGER"
}

export function canViewAudit(role: Role): boolean {
  return role === "RED" || role === "ADMIN"
}

export function canManageUsers(role: Role): boolean {
  return role === "RED" || role === "ADMIN"
}

export function canEditCompanySettings(role: Role): boolean {
  return role === "RED"
}

import "server-only"
import { NextResponse } from "next/server"
import { getSessionUser, type SessionUser } from "@/lib/auth"
import { canAccessModule, type Module, isRole, type Role } from "@/lib/permissions"

/** Standard JSON error with a friendly message — never leaks internals. */
export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

/** Guard: any authenticated, active user. */
export async function requireUser(): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getSessionUser()
  if (!user) return { response: fail(401, "Your session has expired. Please sign in again.") }
  return { user }
}

/** Guard: authenticated user with access to a specific module. */
export async function requireModule(
  module: Module
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const result = await requireUser()
  if ("response" in result) return result
  if (!isRole(result.user.role) || !canAccessModule(result.user.role, module)) {
    return { response: fail(403, "You do not have permission to access this area.") }
  }
  return result
}

/** Guard: authenticated user holding one of the given roles. */
export async function requireRole(
  ...roles: Role[]
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const result = await requireUser()
  if ("response" in result) return result
  if (!roles.includes(result.user.role)) {
    return { response: fail(403, "You do not have permission to perform this action.") }
  }
  return result
}

/** Parse a JSON body defensively. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

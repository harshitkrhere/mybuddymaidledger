import "server-only"
import { cookies } from "next/headers"
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import type { Role } from "@/lib/permissions"
import { isRole } from "@/lib/permissions"

// ============================================================
// Cookie sessions — httpOnly, opaque token, verified server-side
// on every request. Role is always read fresh from the database
// so a role change takes effect on the very next request.
// ============================================================

export const SESSION_COOKIE = "portal_session"
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  status: string
  title: string | null
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex")
  await db.session.create({
    data: {
      id: token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })
  return token
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: token } })
}

/** Returns the active user (or null). Inactive accounts are rejected and their sessions purged. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: true },
  })
  if (!session) return null

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: token } }).catch(() => {})
    return null
  }

  if (session.user.status !== "ACTIVE") {
    await db.session.deleteMany({ where: { userId: session.user.id } }).catch(() => {})
    return null
  }

  if (!isRole(session.user.role)) return null

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    status: session.user.status,
    title: session.user.title,
  }
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

// ============================================================
// Audit trail — every meaningful action lands here.
// ============================================================

export async function audit(params: {
  actorId: string | null
  action: string
  targetType?: string
  targetId?: string
  targetLabel?: string
  detail?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetLabel: params.targetLabel,
        detail: params.detail ? JSON.stringify(params.detail) : null,
      },
    })
  } catch {
    // Never let audit failures break the request path.
  }
}

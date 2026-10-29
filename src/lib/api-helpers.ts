import "server-only"
import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { getSessionUser, type SessionUser } from "@/lib/auth"
import { canAccessModule, type Module, isRole, type Role } from "@/lib/permissions"

// ============================================================
// API foundation — guards, JSON helpers and the route() wrapper.
//
// route() is the error boundary for EVERY endpoint:
//   · any thrown error is caught here — never by Next.js;
//   · the full detail (message + stack + request id) is logged
//     SERVER-SIDE ONLY, so clients can never see internals;
//   · the client gets a short, friendly JSON error plus an
//     X-Request-Id header for support lookups;
//   · known Prisma error codes map to honest HTTP semantics
//     (409 conflict, 404 missing, 400 relation) instead of 500s.
// ============================================================

/** Standard JSON error with a friendly message — never leaks internals. */
export function fail(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers })
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

// ---------------- secure server-side logging ----------------

/** Console logger that keeps credentials and stack traces server-side. */
function logServerError(req: Request, requestId: string, err: unknown) {
  const url = new URL(req.url)
  const detail =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack?.split("\n").slice(0, 6).join(" | ") }
      : { message: String(err) }
  // Strip any query strings that might carry tokens or ids.
  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      method: req.method,
      path: url.pathname,
      detail,
    })
  )
}

// ---------------- Prisma error semantics ----------------

type PrismaLikeError = { code?: string; meta?: { target?: string[] } }

function mapPrismaError(err: PrismaLikeError): { status: number; message: string } | null {
  switch (err.code) {
    case "P2002":
      return { status: 409, message: "That record already exists — please refresh and try again." }
    case "P2025":
      return { status: 404, message: "That record no longer exists." }
    case "P2003":
      return { status: 409, message: "This record is referenced elsewhere and can't be changed this way." }
    default:
      return null
  }
}

// ---------------- the route() error boundary ----------------

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>

/**
 * Wraps an API handler with logging + a hard error boundary.
 * Usage:  export const GET = route("dashboard", async (req) => { ... })
 */
export function route<Ctx = unknown>(name: string, handler: Handler<Ctx>): Handler<Ctx> {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      const requestId = randomUUID().slice(0, 8)
      logServerError(req, requestId, err)

      const mapped = err && typeof err === "object" ? mapPrismaError(err as PrismaLikeError) : null
      if (mapped) {
        return fail(mapped.status, mapped.message, { "X-Request-Id": requestId })
      }
      return fail(500, "Something went wrong on our side. Please try again.", { "X-Request-Id": requestId })
    }
  }
}

// ---------------- auth guards ----------------

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

/** Parse a JSON body defensively (returns null on malformed JSON). */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text()
    if (!text || text.length > 1_000_000) return null // 1 MB request cap
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

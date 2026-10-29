import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireRole } from "@/lib/api-helpers"
import { assignableRoles, isRole, ROLE_RANK } from "@/lib/permissions"

// ============================================================
// /api/users — Team management (Red & Admin only)
// There is no signup endpoint anywhere in this portal; user
// accounts are created here, strictly by role hierarchy.
// ============================================================

// GET — list all users (Red/Admin only)
export async function GET() {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response

  const users = await db.user.findMany({
    orderBy: [{ status: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const sorted = [...users].sort(
    (a, b) => ROLE_RANK[b.role as keyof typeof ROLE_RANK] - ROLE_RANK[a.role as keyof typeof ROLE_RANK]
  )

  const counts = await db.expense.groupBy({
    by: ["submittedById"],
    where: { status: "PENDING" },
    _count: { _all: true },
  })
  const pendingByUser = new Map(counts.map((c) => [c.submittedById, c._count._all]))

  return ok({
    users: sorted.map((u) => ({ ...u, pendingExpenses: pendingByUser.get(u.id) ?? 0 })),
    assignableRoles: assignableRoles(guard.user.role),
  })
}

// POST — create a user. Red may create any role; Admin may ONLY create
// Managers and Employees. Crafted requests are rejected and audited.
export async function POST(req: Request) {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response
  const actor = guard.user

  const body = await readJson<{ name?: string; email?: string; password?: string; role?: string; title?: string }>(req)
  const name = (body?.name ?? "").trim()
  const email = (body?.email ?? "").trim().toLowerCase()
  const password = body?.password ?? ""
  const role = body?.role ?? ""
  const title = (body?.title ?? "").trim() || null

  if (!name || !email || !password || !role) {
    return fail(400, "Name, email, password and role are all required.")
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(400, "That email address doesn't look right.")
  }
  if (password.length < 8) {
    return fail(400, "Passwords must be at least 8 characters.")
  }

  // --- The hierarchy gate: Admins can never mint Admins (or Reds). ---
  if (!isRole(role) || !assignableRoles(actor.role).includes(role)) {
    await audit({
      actorId: actor.id,
      action: "USER_CREATE_BLOCKED",
      targetType: "USER",
      targetLabel: email,
      detail: { attemptedRole: role, actorRole: actor.role },
    })
    return fail(403, "Your role does not allow assigning that role.")
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return fail(409, "A user with that email already exists.")
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: { name, email, passwordHash, role, title },
    select: { id: true, name: true, email: true, role: true, status: true, title: true, createdAt: true, updatedAt: true },
  })

  await audit({
    actorId: actor.id,
    action: "USER_CREATED",
    targetType: "USER",
    targetId: user.id,
    targetLabel: user.email,
    detail: { role, name },
  })

  return ok({ user }, 201)
}

import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireRole, route } from "@/lib/api-helpers"
import { canChangeRoleOf, canDeactivate, isRole, type Role } from "@/lib/permissions"
import { parseWith, UserPatchSchema } from "@/lib/validation"

// ============================================================
// /api/users/[id] — role changes, activation, password resets.
// Enforced server-side regardless of what the UI offers:
//   · Nobody changes their own role or deactivates themselves.
//   · Red edits anyone; Admin edits only Managers/Employees.
//   · Only Red can grant or revoke the Admin role.
// Role changes take effect on the very next request: the session
// resolves the role fresh from the database each time.
// ============================================================

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route<Ctx>("users.update", async (req, ctx) => {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return fail(404, "That user no longer exists.")
  if (!isRole(target.role)) return fail(409, "That user's role is not recognised — please contact Red.")
  const targetRole: Role = target.role

  const isSelf = target.id === actor.id

  const parsed = parseWith(UserPatchSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  // ---------- Role change ----------
  if (body.action === "setRole") {
    const nextRole = body.role
    if (!isRole(nextRole)) return fail(400, "Unknown role.")
    if (isSelf) return fail(403, "You cannot change your own role.")
    if (nextRole === target.role) return fail(400, "That user already has this role.")
    if (!canChangeRoleOf(actor.role, targetRole, nextRole)) {
      await audit({
        actorId: actor.id,
        action: "ROLE_CHANGE_BLOCKED",
        targetType: "USER",
        targetId: target.id,
        targetLabel: target.email,
        detail: { from: target.role, attempted: nextRole, actorRole: actor.role },
      })
      return fail(403, "Your role does not allow this change.")
    }

    await db.user.update({ where: { id: target.id }, data: { role: nextRole } })
    await audit({
      actorId: actor.id,
      action: "ROLE_CHANGED",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
      detail: { from: target.role, to: nextRole },
    })
    return ok({ ok: true })
  }

  // ---------- Activate / deactivate ----------
  if (body.action === "setStatus") {
    const status = body.status
    if (isSelf) return fail(403, "You cannot deactivate your own account.")
    if (target.role === "RED" && actor.role !== "RED") return fail(403, "You cannot modify a Red account.")
    if (!canDeactivate(actor.role, targetRole)) {
      await audit({
        actorId: actor.id,
        action: "STATUS_CHANGE_BLOCKED",
        targetType: "USER",
        targetId: target.id,
        targetLabel: target.email,
        detail: { attempted: status, actorRole: actor.role },
      })
      return fail(403, "Your role does not allow this change.")
    }

    // Deactivation and session purge land together; sessions are also
    // rejected lazily on every request, so the lockout is immediate.
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { status } }),
      ...(status === "INACTIVE" ? [db.session.deleteMany({ where: { userId: target.id } })] : []),
    ])
    await audit({
      actorId: actor.id,
      action: status === "INACTIVE" ? "USER_DEACTIVATED" : "USER_ACTIVATED",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
      detail: { status },
    })
    return ok({ ok: true })
  }

  // ---------- Password reset (performed by Red/Admin) ----------
  if (body.action === "resetPassword") {
    if (isSelf) return fail(403, "Use Settings to change your own password.")
    if (actor.role !== "RED" && (target.role === "ADMIN" || target.role === "RED")) {
      return fail(403, "Your role does not allow resetting that password.")
    }

    const passwordHash = await bcrypt.hash(body.password, 10)
    await db.$transaction([
      db.user.update({ where: { id: target.id }, data: { passwordHash } }),
      db.session.deleteMany({ where: { userId: target.id } }), // force re-login
    ])
    await audit({
      actorId: actor.id,
      action: "PASSWORD_RESET",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
    })
    return ok({ ok: true })
  }

  // ---------- Profile edits (name / title) ----------
  if (body.action === "updateProfile") {
    if (actor.role !== "RED" && target.role !== "MANAGER" && target.role !== "EMPLOYEE") {
      return fail(403, "Your role does not allow editing that profile.")
    }

    await db.user.update({ where: { id: target.id }, data: { name: body.name, title: body.title } })
    await audit({
      actorId: actor.id,
      action: "USER_PROFILE_UPDATED",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
      detail: { name: body.name, title: body.title },
    })
    return ok({ ok: true })
  }

  return fail(400, "Unsupported action.")
})

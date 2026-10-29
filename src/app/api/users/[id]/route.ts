import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireRole } from "@/lib/api-helpers"
import { canChangeRoleOf, canDeactivate, isRole } from "@/lib/permissions"

// ============================================================
// /api/users/[id] — role changes, activation, password resets.
// Enforced server-side regardless of what the UI offers:
//   · Nobody changes their own role or deactivates themselves.
//   · Red edits anyone; Admin edits only Managers/Employees.
//   · Only Red can grant or revoke the Admin role.
// ============================================================

type PatchBody = {
  action?: "setRole" | "setStatus" | "resetPassword" | "updateProfile"
  role?: string
  status?: string
  password?: string
  name?: string
  title?: string
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const target = await db.user.findUnique({ where: { id } })
  if (!target) return fail(404, "That user no longer exists.")

  const isSelf = target.id === actor.id
  const body = await readJson<PatchBody>(req)
  if (!body?.action) return fail(400, "Missing action.")

  // ---------- Role change ----------
  if (body.action === "setRole") {
    const nextRole = body.role ?? ""
    if (!isRole(nextRole)) return fail(400, "Unknown role.")
    if (isSelf) return fail(403, "You cannot change your own role.")
    if (nextRole === target.role) return fail(400, "That user already has this role.")
    if (!canChangeRoleOf(actor.role, target.role, nextRole)) {
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
    const status = body.status ?? ""
    if (status !== "ACTIVE" && status !== "INACTIVE") return fail(400, "Unknown status.")
    if (isSelf) return fail(403, "You cannot deactivate your own account.")
    if (target.role === "RED" && actor.role !== "RED") return fail(403, "You cannot modify a Red account.")
    if (!canDeactivate(actor.role, target.role)) {
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

    await db.user.update({ where: { id: target.id }, data: { status } })
    if (status === "INACTIVE") {
      // Purge sessions so the lockout is immediate.
      await db.session.deleteMany({ where: { userId: target.id } })
    }
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
    const password = body.password ?? ""
    if (isSelf) return fail(403, "Use Settings to change your own password.")
    if (password.length < 8) return fail(400, "Passwords must be at least 8 characters.")
    if (actor.role !== "RED" && (target.role === "ADMIN" || target.role === "RED")) {
      return fail(403, "Your role does not allow resetting that password.")
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await db.user.update({ where: { id: target.id }, data: { passwordHash } })
    await db.session.deleteMany({ where: { userId: target.id } }) // force re-login
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
    const name = (body.name ?? "").trim()
    const title = (body.title ?? "").trim() || null
    if (!name) return fail(400, "Name cannot be empty.")

    await db.user.update({ where: { id: target.id }, data: { name, title } })
    await audit({
      actorId: actor.id,
      action: "USER_PROFILE_UPDATED",
      targetType: "USER",
      targetId: target.id,
      targetLabel: target.email,
      detail: { name, title },
    })
    return ok({ ok: true })
  }

  return fail(400, "Unsupported action.")
}

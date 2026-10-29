import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireUser, route } from "@/lib/api-helpers"
import { canEditCompanySettings } from "@/lib/permissions"
import { parseWith, SettingsSchema } from "@/lib/validation"

// ============================================================
// /api/settings — profile & password (everyone) and company
// settings (Red only, enforced server-side).
// ============================================================

export const GET = route("settings.get", async () => {
  const guard = await requireUser()
  if ("response" in guard) return guard.response

  const settings = await db.companySettings.findUnique({ where: { id: "singleton" } })
  return ok({
    profile: {
      name: guard.user.name,
      email: guard.user.email,
      role: guard.user.role,
      title: guard.user.title,
      createdAt: (await db.user.findUnique({ where: { id: guard.user.id }, select: { createdAt: true } }))?.createdAt,
    },
    company: settings,
    canEditCompany: canEditCompanySettings(guard.user.role),
  })
})

export const PATCH = route("settings.update", async (req) => {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user

  const parsed = parseWith(SettingsSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  // ---------- Profile ----------
  if (body.action === "profile") {
    await db.user.update({ where: { id: user.id }, data: { name: body.name, title: body.title } })
    await audit({
      actorId: user.id,
      action: "PROFILE_UPDATED",
      targetType: "USER",
      targetId: user.id,
      targetLabel: user.email,
      detail: { name: body.name, title: body.title },
    })
    return ok({ ok: true })
  }

  // ---------- Password change (self, current password required) ----------
  if (body.action === "password") {
    const me = await db.user.findUnique({ where: { id: user.id } })
    if (!me) return fail(404, "Account not found.")
    const matches = await bcrypt.compare(body.currentPassword, me.passwordHash)
    if (!matches) return fail(400, "Your current password is incorrect.")

    const passwordHash = await bcrypt.hash(body.newPassword, 10)
    await db.user.update({ where: { id: user.id }, data: { passwordHash } })
    await audit({
      actorId: user.id,
      action: "PASSWORD_CHANGED",
      targetType: "USER",
      targetId: user.id,
      targetLabel: user.email,
    })
    return ok({ ok: true })
  }

  // ---------- Company settings (Red only) ----------
  if (body.action === "company") {
    if (!canEditCompanySettings(user.role)) {
      await audit({
        actorId: user.id,
        action: "SETTINGS_CHANGE_BLOCKED",
        targetType: "SETTINGS",
        detail: { attemptedBy: user.role },
      })
      return fail(403, "Only Red can change company settings.")
    }

    const data: Record<string, unknown> = {}
    if (body.companyName !== undefined) data.companyName = body.companyName
    if (body.currency !== undefined) data.currency = body.currency
    if (body.taxRate !== undefined) data.taxRate = body.taxRate
    if (body.email !== undefined) data.email = body.email.trim() === "" ? null : body.email.trim()
    if (body.phone !== undefined) data.phone = body.phone.trim() === "" ? null : body.phone.trim()
    if (body.address !== undefined) data.address = body.address.trim() === "" ? null : body.address.trim()

    const settings = await db.companySettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    })

    await audit({
      actorId: user.id,
      action: "SETTINGS_UPDATED",
      targetType: "SETTINGS",
      targetLabel: settings.companyName,
      detail: data,
    })
    return ok({ settings })
  }

  return fail(400, "Unsupported action.")
})

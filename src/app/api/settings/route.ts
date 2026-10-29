import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireUser } from "@/lib/api-helpers"
import { canEditCompanySettings } from "@/lib/permissions"

// ============================================================
// /api/settings — profile & password (everyone) and company
// settings (Red only, enforced server-side).
// ============================================================

export async function GET() {
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
}

type SettingsBody = {
  action?: "profile" | "password" | "company"
  name?: string
  title?: string
  currentPassword?: string
  newPassword?: string
  companyName?: string
  currency?: string
  taxRate?: number
  email?: string
  phone?: string
  address?: string
}

export async function PATCH(req: Request) {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user

  const body = await readJson<SettingsBody>(req)
  if (!body?.action) return fail(400, "Missing action.")

  // ---------- Profile ----------
  if (body.action === "profile") {
    const name = (body.name ?? "").trim()
    const title = (body.title ?? "").trim() || null
    if (!name) return fail(400, "Name cannot be empty.")

    await db.user.update({ where: { id: user.id }, data: { name, title } })
    await audit({
      actorId: user.id,
      action: "PROFILE_UPDATED",
      targetType: "USER",
      targetId: user.id,
      targetLabel: user.email,
      detail: { name, title },
    })
    return ok({ ok: true })
  }

  // ---------- Password change (self, current password required) ----------
  if (body.action === "password") {
    const current = body.currentPassword ?? ""
    const next = body.newPassword ?? ""
    if (next.length < 8) return fail(400, "New passwords must be at least 8 characters.")

    const me = await db.user.findUnique({ where: { id: user.id } })
    if (!me) return fail(404, "Account not found.")
    const matches = await bcrypt.compare(current, me.passwordHash)
    if (!matches) return fail(400, "Your current password is incorrect.")

    const passwordHash = await bcrypt.hash(next, 10)
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
    if (body.companyName !== undefined) data.companyName = body.companyName.trim() || "My Company"
    if (body.currency !== undefined) data.currency = ["INR", "USD", "EUR", "GBP", "AED", "SGD"].includes(body.currency) ? body.currency : "INR"
    if (body.taxRate !== undefined) data.taxRate = Math.min(100, Math.max(0, Number(body.taxRate) || 0))
    if (body.email !== undefined) data.email = body.email.trim() || null
    if (body.phone !== undefined) data.phone = body.phone.trim() || null
    if (body.address !== undefined) data.address = body.address.trim() || null

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
}

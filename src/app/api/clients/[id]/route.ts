import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, requireRole } from "@/lib/api-helpers"

// ============================================================
// /api/clients/[id] — edit / deactivate / delete.
// Deleting a client with billing history is refused; deactivate
// instead so the ledger stays honest.
// ============================================================

type ClientBody = {
  name?: string
  type?: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  isActive?: boolean
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireModule("clients")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const existing = await db.client.findUnique({ where: { id } })
  if (!existing) return fail(404, "That client no longer exists.")

  const body = await readJson<ClientBody>(req)
  if (!body) return fail(400, "Missing client details.")
  if (body.name !== undefined && !body.name.trim()) return fail(400, "Name cannot be empty.")
  if (body.type !== undefined && body.type !== "CLIENT" && body.type !== "VENDOR") {
    return fail(400, "Type must be client or vendor.")
  }

  const client = await db.client.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.email !== undefined ? { email: body.email.trim() || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone.trim() || null } : {}),
      ...(body.address !== undefined ? { address: body.address.trim() || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes.trim() || null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  })

  await audit({
    actorId: actor.id,
    action: "CLIENT_UPDATED",
    targetType: "CLIENT",
    targetId: id,
    targetLabel: client.name,
    detail: { isActive: client.isActive },
  })

  return ok({ client })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params

  const existing = await db.client.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true, transactions: true } } },
  })
  if (!existing) return fail(404, "That client no longer exists.")

  if (existing._count.invoices > 0 || existing._count.transactions > 0) {
    return fail(409, "This client has billing history and cannot be deleted. Deactivate it instead.")
  }

  await db.client.delete({ where: { id } })
  await audit({
    actorId: guard.user.id,
    action: "CLIENT_DELETED",
    targetType: "CLIENT",
    targetId: id,
    targetLabel: existing.name,
  })

  return ok({ ok: true })
}

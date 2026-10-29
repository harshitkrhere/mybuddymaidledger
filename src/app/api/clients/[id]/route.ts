import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, requireRole, route } from "@/lib/api-helpers"
import { ClientPatchSchema, parseWith } from "@/lib/validation"

// ============================================================
// /api/clients/[id] — edit / deactivate / delete.
// Deleting a client with billing history is refused (FK-checked);
// deactivate instead so the ledger stays honest.
// ============================================================

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route<Ctx>("clients.update", async (req, ctx) => {
  const guard = await requireModule("clients")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const existing = await db.client.findUnique({ where: { id } })
  if (!existing) return fail(404, "That client no longer exists.")

  const parsed = parseWith(ClientPatchSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  const client = await db.client.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.email !== undefined ? { email: body.email === "" ? null : body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone === "" ? null : body.phone } : {}),
      ...(body.address !== undefined ? { address: body.address === "" ? null : body.address } : {}),
      ...(body.notes !== undefined ? { notes: body.notes === "" ? null : body.notes } : {}),
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
})

export const DELETE = route<Ctx>("clients.delete", async (_req, ctx) => {
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
})

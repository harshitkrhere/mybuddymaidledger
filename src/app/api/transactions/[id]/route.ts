import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, requireRole, route } from "@/lib/api-helpers"
import { parseWith, TransactionSchema } from "@/lib/validation"

// ============================================================
// /api/transactions/[id] — edit (finance) / delete (Red & Admin)
// ============================================================

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = route<Ctx>("transactions.update", async (req, ctx) => {
  const guard = await requireModule("transactions")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const existing = await db.transaction.findUnique({ where: { id } })
  if (!existing) return fail(404, "That transaction no longer exists.")

  const parsed = parseWith(TransactionSchema, await readJson(req))
  if (!parsed.ok) return fail(400, parsed.error)
  const body = parsed.value

  if (body.categoryId && !(await db.category.findUnique({ where: { id: body.categoryId } }))) {
    return fail(400, "That category no longer exists.")
  }
  if (body.clientId && !(await db.client.findUnique({ where: { id: body.clientId } }))) {
    return fail(400, "That client no longer exists.")
  }

  const tx = await db.transaction.update({
    where: { id },
    data: {
      date: new Date(body.date),
      type: body.type,
      amount: body.amount,
      description: body.description,
      categoryId: body.categoryId,
      clientId: body.clientId,
      reference: body.reference,
      paymentMethod: body.paymentMethod,
    },
    include: {
      category: true,
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  await audit({
    actorId: actor.id,
    action: "TRANSACTION_UPDATED",
    targetType: "TRANSACTION",
    targetId: tx.id,
    targetLabel: tx.description,
    detail: {
      from: { type: existing.type, amount: existing.amount, date: existing.date },
      to: { type: tx.type, amount: tx.amount, date: tx.date },
    },
  })

  return ok({ transaction: tx })
})

export const DELETE = route<Ctx>("transactions.delete", async (_req, ctx) => {
  const guard = await requireRole("RED", "ADMIN")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params

  const existing = await db.transaction.findUnique({ where: { id } })
  if (!existing) return fail(404, "That transaction no longer exists.")

  await db.transaction.delete({ where: { id } })
  await audit({
    actorId: guard.user.id,
    action: "TRANSACTION_DELETED",
    targetType: "TRANSACTION",
    targetId: id,
    targetLabel: existing.description,
    detail: { type: existing.type, amount: existing.amount, date: existing.date },
  })

  return ok({ ok: true })
})

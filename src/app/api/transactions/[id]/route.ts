import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireModule, requireRole } from "@/lib/api-helpers"
import { validateTxBody } from "@/lib/finance-validation"

// ============================================================
// /api/transactions/[id] — edit (finance) / delete (Red & Admin)
// ============================================================

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireModule("transactions")
  if ("response" in guard) return guard.response
  const actor = guard.user
  const { id } = await ctx.params

  const existing = await db.transaction.findUnique({ where: { id } })
  if (!existing) return fail(404, "That transaction no longer exists.")

  const body = await readJson<Parameters<typeof validateTxBody>[0]>(req)
  const error = validateTxBody(body)
  if (error) return fail(400, error)

  const tx = await db.transaction.update({
    where: { id },
    data: {
      date: new Date(body!.date!),
      type: body!.type!,
      amount: body!.amount!,
      description: body!.description!.trim(),
      categoryId: body!.categoryId || null,
      clientId: body!.clientId || null,
      reference: (body!.reference ?? "").trim() || null,
      paymentMethod: body!.paymentMethod ?? "BANK",
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
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
}

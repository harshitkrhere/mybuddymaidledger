import { db } from "@/lib/db"
import { audit } from "@/lib/auth"
import { fail, ok, readJson, requireUser } from "@/lib/api-helpers"
import { canApproveExpenses, canDeleteRecords } from "@/lib/permissions"

// ============================================================
// /api/expenses/[id] — review (approve/reject), edit, delete.
// Nobody reviews their own submission. Owners may edit or
// withdraw while still PENDING. Red/Admin may delete anything.
// ============================================================

type PatchBody =
  | { action: "review"; status: "APPROVED" | "REJECTED"; note?: string }
  | { action?: undefined; date?: string; amount?: number; description?: string; categoryId?: string | null; receiptRef?: string | null }

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user
  const { id } = await ctx.params

  const existing = await db.expense.findUnique({
    where: { id },
    include: { submitter: { select: { id: true, name: true, email: true } } },
  })
  if (!existing) return fail(404, "That expense no longer exists.")

  const body = await readJson<PatchBody>(req)

  // ---------- Approve / reject ----------
  if (body && body.action === "review") {
    if (!canApproveExpenses(user.role)) {
      return fail(403, "You do not have permission to review expenses.")
    }
    if (existing.submittedById === user.id) {
      return fail(403, "You cannot review your own submission.")
    }
    const status = body.status
    if (status !== "APPROVED" && status !== "REJECTED") return fail(400, "Unknown review status.")
    if (existing.status !== "PENDING") return fail(400, "This expense has already been reviewed.")

    await db.expense.update({
      where: { id },
      data: {
        status,
        reviewedById: user.id,
        reviewNote: (body.note ?? "").trim() || null,
        reviewedAt: new Date(),
      },
    })
    await audit({
      actorId: user.id,
      action: status === "APPROVED" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
      targetType: "EXPENSE",
      targetId: id,
      targetLabel: existing.description,
      detail: {
        submitter: existing.submitter.email,
        amount: existing.amount,
        note: (body.note ?? "").trim() || null,
      },
    })
    return ok({ ok: true })
  }

  // ---------- Owner edit (only while pending) ----------
  const isOwner = existing.submittedById === user.id
  if (!isOwner) return fail(403, "Only the submitter can edit this expense.")
  if (existing.status !== "PENDING") return fail(400, "Reviewed expenses can no longer be edited.")

  const b = body as Exclude<PatchBody, { action: "review" }>
  if (!b) return fail(400, "Missing expense details.")
  if (b.date && isNaN(Date.parse(b.date))) return fail(400, "Please pick a valid date.")
  if (b.amount !== undefined && b.amount <= 0) return fail(400, "Amount must be greater than zero.")
  if (b.description !== undefined && !b.description.trim()) return fail(400, "Please describe the expense.")

  const expense = await db.expense.update({
    where: { id },
    data: {
      ...(b.date ? { date: new Date(b.date) } : {}),
      ...(b.amount !== undefined ? { amount: b.amount } : {}),
      ...(b.description !== undefined ? { description: b.description.trim() } : {}),
      ...(b.categoryId !== undefined ? { categoryId: b.categoryId || null } : {}),
      ...(b.receiptRef !== undefined ? { receiptRef: b.receiptRef.trim() || null } : {}),
    },
    include: {
      category: true,
      submitter: { select: { id: true, name: true, role: true } },
      reviewer: { select: { id: true, name: true } },
    },
  })

  await audit({
    actorId: user.id,
    action: "EXPENSE_UPDATED",
    targetType: "EXPENSE",
    targetId: id,
    targetLabel: expense.description,
    detail: { from: { amount: existing.amount }, to: { amount: expense.amount } },
  })

  return ok({ expense })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireUser()
  if ("response" in guard) return guard.response
  const user = guard.user
  const { id } = await ctx.params

  const existing = await db.expense.findUnique({ where: { id } })
  if (!existing) return fail(404, "That expense no longer exists.")

  const isOwner = existing.submittedById === user.id
  const mayDelete = (isOwner && existing.status === "PENDING") || canDeleteRecords(user.role)
  if (!mayDelete) return fail(403, "You do not have permission to delete this expense.")

  await db.expense.delete({ where: { id } })
  await audit({
    actorId: user.id,
    action: "EXPENSE_DELETED",
    targetType: "EXPENSE",
    targetId: id,
    targetLabel: existing.description,
    detail: { amount: existing.amount },
  })

  return ok({ ok: true })
}
